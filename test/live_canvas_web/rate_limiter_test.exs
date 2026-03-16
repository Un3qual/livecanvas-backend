defmodule LC.RateLimiterTest do
  use ExUnit.Case, async: false

  @mock_erpc __MODULE__.MockErpc

  setup do
    original_env = Application.get_env(:live_canvas, LC.RateLimiter, [])

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, original_env)
    end)

    LC.RateLimiter.reset!()
    Process.delete(:erpc_response)
    :ok
  end

  describe "owner selection" do
    test "is deterministic even when node order changes" do
      configure_env(cluster_nodes: [:zig@localhost, :alpha@localhost])

      subject = "stable-subject"
      first_owner = LC.RateLimiter.owner_node(:auth_login, subject)

      configure_env(cluster_nodes: [:alpha@localhost, :zig@localhost])
      second_owner = LC.RateLimiter.owner_node(:auth_login, subject)

      assert first_owner == second_owner
    end
  end

  describe "cluster-aware routing" do
    test "forwards to the owner via :erpc" do
      configure_env(cluster_nodes: [:remote@localhost], erpc_module: @mock_erpc)
      Process.put(:erpc_response, {:error, :rate_limited})

      subject = "remote-subject"
      limit_key = :auth_login

      assert {:error, :rate_limited} == LC.RateLimiter.allow(limit_key, subject)
    end

    test "falls back to local enforcement when :erpc fails" do
      configure_env(
        cluster_nodes: [:remote@localhost],
        erpc_module: @mock_erpc,
        limits: [auth_login: [limit: 1, window_ms: 60_000]]
      )

      Process.put(:erpc_response, {:badrpc, :timeout})

      subject = "fallback-subject"
      limit_key = :auth_login

      assert :ok == LC.RateLimiter.allow(limit_key, subject)
      assert {:error, :rate_limited} == LC.RateLimiter.allow(limit_key, subject)
    end
  end

  defp configure_env(opts) do
    base = Application.get_env(:live_canvas, LC.RateLimiter, [])
    Application.put_env(:live_canvas, LC.RateLimiter, Keyword.merge(base, opts))
  end

  defmodule MockErpc do
    def call(node, mod, fun, args, _timeout) do
      _ = {node, mod, fun, args}

      case Process.get(:erpc_response) do
        nil -> :ok
        response -> response
      end
    end
  end
end
