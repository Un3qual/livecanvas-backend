defmodule LC.Live.DistributedRuntimeTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live
  alias LC.Live.{SessionOwnership, SessionSupervisor}
  alias LCSchemas.Live.{LiveParticipant, LiveSession, LiveSessionRuntimeOwner}

  defmodule FakeRuntimeRPC do
    @moduledoc false

    def call(owner_node, module, function, args, opts \\ []) do
      test_pid = Process.get(:fake_runtime_rpc_test_pid)

      if is_pid(test_pid) do
        send(test_pid, {:runtime_rpc_call, owner_node, module, function, args, opts})
      end

      case Process.get(:fake_runtime_rpc_responses, []) do
        [response | rest] ->
          Process.put(:fake_runtime_rpc_responses, rest)
          response

        [] ->
          {:error, :remote_unreachable}
      end
    end
  end

  describe "lookup_session_server/1" do
    test "returns owned_by_remote when session lease belongs to another node" do
      session = live_session_fixture()
      remote_owner = "remote-owner@127.0.0.1"

      assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())

      assert {:error, {:owned_by_remote, ^remote_owner}} =
               Live.lookup_session_server(session.id)
    end
  end

  describe "join_live_session/4 with remote runtime ownership" do
    test "routes remote lookup and join through runtime RPC" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())

      configure_runtime_rpc([
        {:ok, :ok},
        {:ok, :ok}
      ])

      assert {:ok, %LiveParticipant{live_session_id: session_id, user_id: viewer_id}} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )

      assert session_id == session.id
      assert viewer_id == viewer.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_lookup_session_server,
                      [remote_session_id], _opts}

      assert remote_session_id == session.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_join_session_server,
                      [joined_session_id, joined_viewer_id, :viewer], _opts}

      assert joined_session_id == session.id
      assert joined_viewer_id == viewer.id
    end

    test "maps remote lookup failure to a stable reason atom" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())
      configure_runtime_rpc([{:error, :remote_timeout}])

      assert {:error, :remote_timeout} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )
    end

    test "maps remote runtime not found to a stable reason atom" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())

      configure_runtime_rpc([
        {:ok, :ok},
        {:ok, {:error, :not_found}}
      ])

      assert {:error, :remote_not_found} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )
    end

    test "routes to remote owner when a stale local runtime process still exists" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      assert {:ok, stale_local_pid} =
               SessionSupervisor.start_session_server(
                 session.id,
                 %{},
                 lease_heartbeat_interval_ms: 60_000
               )

      assert Process.alive?(stale_local_pid)

      lease = Repo.get_by!(LiveSessionRuntimeOwner, live_session_id: session.id)
      takeover_at = DateTime.add(now_utc(), 60, :second)

      lease
      |> Ecto.Changeset.change(
        owner_node: remote_owner,
        heartbeat_at: takeover_at,
        lease_expires_at: DateTime.add(takeover_at, 30, :second)
      )
      |> Repo.update!()

      configure_runtime_rpc([
        {:ok, :ok},
        {:ok, :ok}
      ])

      assert {:ok, %LiveParticipant{live_session_id: session_id, user_id: viewer_id}} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )

      assert session_id == session.id
      assert viewer_id == viewer.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_lookup_session_server,
                      [remote_session_id], _opts}

      assert remote_session_id == session.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_join_session_server,
                      [joined_session_id, joined_viewer_id, :viewer], _opts}

      assert joined_session_id == session.id
      assert joined_viewer_id == viewer.id
    end
  end

  defp live_session_fixture(host_id \\ nil) do
    host_id = host_id || user_fixture().id

    Repo.insert!(%LiveSession{
      host_id: host_id,
      status: :live,
      visibility: :public
    })
  end

  defp configure_runtime_rpc(responses) when is_list(responses) do
    Process.put(:fake_runtime_rpc_test_pid, self())
    Process.put(:fake_runtime_rpc_responses, responses)

    on_exit(fn ->
      Process.delete(:fake_runtime_rpc_test_pid)
      Process.delete(:fake_runtime_rpc_responses)
    end)

    :ok
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
