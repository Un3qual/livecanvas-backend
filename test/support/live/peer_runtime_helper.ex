defmodule LC.TestSupport.Live.PeerRuntimeHelper do
  @moduledoc false

  alias LC.Infra.Repo

  @type timeout_ms :: pos_integer()
  @type peer_pid :: pid()
  @type peer_node :: node()

  @spec with_local_repo_auto_mode((-> term())) :: term()
  def with_local_repo_auto_mode(fun) when is_function(fun, 0) do
    Ecto.Adapters.SQL.Sandbox.mode(Repo, :auto)

    try do
      fun.()
    after
      Ecto.Adapters.SQL.Sandbox.mode(Repo, :manual)
    end
  end

  @spec with_peer_node((peer_node() -> term())) :: term()
  def with_peer_node(fun) when is_function(fun, 1) do
    :ok = ensure_distributed_node!()
    {:ok, peer_pid, node_name} = start_peer!()

    try do
      :ok = bootstrap_peer_node(node_name)
      fun.(node_name)
    after
      :ok = stop_peer(peer_pid)
    end
  end

  @spec rpc_call(peer_node(), module(), atom(), [term()]) :: term()
  def rpc_call(node_name, module, function, args)
      when is_atom(node_name) and is_atom(module) and is_atom(function) and is_list(args) do
    :erpc.call(node_name, module, function, args, rpc_timeout_ms())
  end

  @spec disconnect_peer(peer_node()) :: :ok
  def disconnect_peer(node_name) when is_atom(node_name) do
    # Ask the peer to sever distribution first, then ensure local side is
    # disconnected. This models a partition without requiring the peer process
    # itself to terminate.
    _ = :erpc.call(node_name, :erlang, :disconnect_node, [Node.self()], 1_000)
    _ = Node.disconnect(node_name)
    :ok
  rescue
    ErlangError ->
      _ = Node.disconnect(node_name)
      :ok
  end

  @spec connect_peer(peer_node()) :: :ok
  def connect_peer(node_name) when is_atom(node_name) do
    _ =
      case Node.connect(node_name) do
        true -> :ok
        false -> :error
        :ignored -> :ok
      end

    :ok
  end

  @spec await_peer_connected(peer_node()) :: :ok
  def await_peer_connected(node_name) when is_atom(node_name) do
    await_peer_state(node_name, :connected, peer_connect_attempts())
  end

  @spec await_peer_disconnected(peer_node()) :: :ok
  def await_peer_disconnected(node_name) when is_atom(node_name) do
    await_peer_state(node_name, :disconnected, peer_connect_attempts())
  end

  @spec ensure_distributed_node!() :: :ok
  def ensure_distributed_node! do
    :ok = ensure_epmd_running!()

    if Node.alive?() do
      if Node.get_cookie() != cookie() do
        true = Node.set_cookie(cookie())
      end

      :ok
    else
      node_name = :"lc_runtime_controller_#{System.unique_integer([:positive, :monotonic])}"

      case :net_kernel.start([node_name, :shortnames]) do
        {:ok, _pid} ->
          true = Node.set_cookie(cookie())
          :ok

        {:error, {:already_started, _pid}} ->
          :ok

        {:error, reason} ->
          raise "failed to start distributed test node: #{inspect(reason)}"
      end
    end
  end

  @spec ensure_epmd_running!() :: :ok
  defp ensure_epmd_running! do
    case System.cmd("epmd", ["-names"]) do
      {_output, 0} ->
        :ok

      {_output, _status} ->
        case System.cmd("epmd", ["-daemon"]) do
          {_daemon_output, 0} ->
            :ok

          {daemon_output, status} ->
            raise "failed to start epmd (status #{status}): #{daemon_output}"
        end
    end
  end

  @spec start_peer!() :: {:ok, peer_pid(), peer_node()}
  defp start_peer! do
    peer_name = :"lc_runtime_peer_#{System.unique_integer([:positive, :monotonic])}"

    peer_options = %{
      name: peer_name,
      peer_down: :continue,
      args: [~c"-setcookie", Atom.to_charlist(cookie())]
    }

    case :peer.start_link(peer_options) do
      {:ok, peer_pid, node_name} ->
        {:ok, peer_pid, node_name}

      {:error, reason} ->
        raise "failed to start peer node: #{inspect(reason)}"
    end
  end

  @spec stop_peer(peer_pid()) :: :ok
  defp stop_peer(peer_pid) when is_pid(peer_pid) do
    case :peer.stop(peer_pid) do
      :ok -> :ok
      {:error, :noproc} -> :ok
      {:error, _reason} -> :ok
    end
  catch
    :exit, _reason ->
      :ok
  end

  @spec bootstrap_peer_node(peer_node()) :: :ok
  defp bootstrap_peer_node(node_name) when is_atom(node_name) do
    :ok = :erpc.call(node_name, :code, :add_paths, [:code.get_path()], rpc_timeout_ms())
    :ok = copy_application_env(node_name, :live_canvas)

    :ok =
      :erpc.call(
        node_name,
        Application,
        :put_env,
        [:swoosh, :api_client, false, [persistent: true]],
        rpc_timeout_ms()
      )

    case :erpc.call(
           node_name,
           Application,
           :ensure_all_started,
           [:live_canvas],
           peer_startup_timeout_ms()
         ) do
      {:ok, _started_apps} ->
        :ok

      {:error, {:already_started, _app}} ->
        :ok

      {:error, reason} ->
        raise "failed to start live_canvas on peer node #{inspect(node_name)}: #{inspect(reason)}"
    end

    :ok = :erpc.call(node_name, Ecto.Adapters.SQL.Sandbox, :mode, [Repo, :auto], rpc_timeout_ms())
  end

  @spec copy_application_env(peer_node(), atom()) :: :ok
  defp copy_application_env(node_name, app) when is_atom(node_name) and is_atom(app) do
    app
    |> Application.get_all_env()
    |> Enum.each(fn {key, value} ->
      :ok =
        :erpc.call(
          node_name,
          Application,
          :put_env,
          [app, key, value, [persistent: true]],
          rpc_timeout_ms()
        )
    end)

    :ok
  end

  @spec await_peer_state(peer_node(), :connected | :disconnected, non_neg_integer()) :: :ok
  defp await_peer_state(node_name, _target_state, 0) when is_atom(node_name) do
    raise "timed out waiting for peer node state transition: #{inspect(node_name)}"
  end

  defp await_peer_state(node_name, :connected, attempts_left) when is_atom(node_name) do
    if peer_reachable?(node_name) do
      :ok
    else
      Process.sleep(peer_poll_interval_ms())
      await_peer_state(node_name, :connected, attempts_left - 1)
    end
  end

  defp await_peer_state(node_name, :disconnected, attempts_left) when is_atom(node_name) do
    if peer_reachable?(node_name) do
      Process.sleep(peer_poll_interval_ms())
      await_peer_state(node_name, :disconnected, attempts_left - 1)
    else
      :ok
    end
  end

  @spec peer_reachable?(peer_node()) :: boolean()
  defp peer_reachable?(node_name) when is_atom(node_name) do
    case :erpc.call(node_name, :erlang, :node, [], 250) do
      ^node_name -> true
      _other -> false
    end
  rescue
    ErlangError ->
      false
  catch
    :exit, _reason ->
      false
  end

  @spec helper_config() :: keyword()
  defp helper_config do
    Application.get_env(:live_canvas, __MODULE__, [])
  end

  @spec rpc_timeout_ms() :: timeout_ms()
  defp rpc_timeout_ms do
    Keyword.get(helper_config(), :rpc_timeout_ms, 5_000)
  end

  @spec peer_startup_timeout_ms() :: timeout_ms()
  defp peer_startup_timeout_ms do
    Keyword.get(helper_config(), :peer_startup_timeout_ms, 15_000)
  end

  @spec peer_connect_attempts() :: pos_integer()
  defp peer_connect_attempts do
    Keyword.get(helper_config(), :peer_connect_attempts, 80)
  end

  @spec peer_poll_interval_ms() :: timeout_ms()
  defp peer_poll_interval_ms do
    Keyword.get(helper_config(), :peer_poll_interval_ms, 25)
  end

  @spec cookie() :: atom()
  defp cookie do
    Keyword.get(helper_config(), :cookie, :live_canvas_peer_runtime)
  end
end
