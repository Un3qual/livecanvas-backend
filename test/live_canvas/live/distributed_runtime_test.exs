defmodule LC.Live.DistributedRuntimeTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live
  alias LC.Live.SessionSupervisor
  alias LC.RealtimeRuntime
  alias LCSchemas.Live.{LiveParticipant, LiveSession}

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
    test "returns owned_by_remote when shard ownership belongs to another node" do
      session = live_session_fixture()
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      assert {:error, {:owned_by_remote, ^remote_owner}} =
               Live.lookup_session_server(session.id)
    end
  end

  describe "stop_session_runtime/1 with remote runtime ownership" do
    test "returns the remote owner instead of reporting a local stop" do
      session = live_session_fixture()
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      assert {:error, {:owned_by_remote, ^remote_owner}} =
               RealtimeRuntime.stop_session_runtime(session.id)
    end
  end

  describe "start_live_session/3 with remote runtime ownership" do
    test "routes runtime start through the remote shard owner" do
      host = user_fixture()
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner_for_shard(0, remote_owner)
      configure_runtime_rpc([{:ok, :ok}])

      assert {:ok, %LiveSession{id: session_id}} =
               apply(Live, :start_live_session, [
                 host,
                 %{visibility: :public},
                 [runtime_rpc: FakeRuntimeRPC]
               ])

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_start_session_server,
                      [^session_id, %{}], _opts}
    end
  end

  describe "join_live_session/4 with remote runtime ownership" do
    test "remote join starts a missing local runtime before admitting the viewer" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)

      on_exit(fn ->
        RealtimeRuntime.stop_session_runtime(session.id)
      end)

      assert {:error, :not_found} = SessionSupervisor.lookup_session_server(session.id)

      assert :ok = Live.remote_join_session_server(session.id, viewer.id, :viewer)
      assert {:ok, pid} = SessionSupervisor.lookup_session_server(session.id)
      assert %{participants: participants} = LC.Live.SessionServer.snapshot(pid)
      assert %{user_id: viewer_id, role: :viewer} = Map.fetch!(participants, viewer.id)
      assert viewer_id == viewer.id
    end

    test "routes remote join through runtime RPC" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      configure_runtime_rpc([{:ok, :ok}])

      assert {:ok, %LiveParticipant{live_session_id: session_id, user_id: viewer_id}} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )

      assert session_id == session.id
      assert viewer_id == viewer.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_join_session_server,
                      [joined_session_id, joined_viewer_id, :viewer], _opts}

      assert joined_session_id == session.id
      assert joined_viewer_id == viewer.id
    end

    test "maps remote join transport failure to a stable reason atom" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)
      configure_runtime_rpc([{:error, :remote_timeout}])

      assert {:error, :remote_timeout} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )
    end

    test "ignores app-config runtime RPC module swaps" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"
      previous_live_config = Application.get_env(:live_canvas, Live, [])

      Application.put_env(
        :live_canvas,
        Live,
        Keyword.put(previous_live_config, :runtime_rpc, FakeRuntimeRPC)
      )

      on_exit(fn ->
        Application.put_env(:live_canvas, Live, previous_live_config)
      end)

      put_remote_owner(session, remote_owner)
      configure_runtime_rpc([{:ok, :ok}])

      assert {:error, :remote_unreachable} =
               Live.join_live_session(session, viewer, :viewer)

      refute_received {:runtime_rpc_call, ^remote_owner, Live, _function, _args, _opts}
    end

    test "maps remote runtime not found to a stable reason atom" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      configure_runtime_rpc([{:ok, {:error, :not_found}}])

      assert {:error, :remote_not_found} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )
    end

    test "retries remote join once when runtime not found and then succeeds" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      configure_runtime_rpc([
        {:ok, {:error, :not_found}},
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

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_join_session_server,
                      [first_join_session_id, first_join_viewer_id, :viewer], _opts}

      assert first_join_session_id == session.id
      assert first_join_viewer_id == viewer.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_join_session_server,
                      [retry_join_session_id, retry_join_viewer_id, :viewer], _opts}

      assert retry_join_session_id == session.id
      assert retry_join_viewer_id == viewer.id
    end

    test "does not persist a participant row when remote join fails after retry" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      configure_runtime_rpc([
        {:ok, {:error, :not_found}},
        {:ok, {:error, :not_found}}
      ])

      assert {:error, :remote_not_found} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )

      assert is_nil(Repo.get_by(LiveParticipant, live_session_id: session.id, user_id: viewer.id))
    end

    test "routes to remote owner when a stale local runtime process still exists" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      assert {:ok, stale_local_pid} = SessionSupervisor.start_session_server(session.id)

      assert Process.alive?(stale_local_pid)
      put_remote_owner(session, remote_owner)

      configure_runtime_rpc([{:ok, :ok}])

      assert {:ok, %LiveParticipant{live_session_id: session_id, user_id: viewer_id}} =
               Live.join_live_session(
                 session,
                 viewer,
                 :viewer,
                 runtime_rpc: FakeRuntimeRPC
               )

      assert session_id == session.id
      assert viewer_id == viewer.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_join_session_server,
                      [joined_session_id, joined_viewer_id, :viewer], _opts}

      assert joined_session_id == session.id
      assert joined_viewer_id == viewer.id
    end
  end

  describe "leave_live_session/3 with remote runtime ownership" do
    test "routes remote leave through runtime RPC" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)
      configure_runtime_rpc([{:ok, :ok}])

      assert :ok = Live.leave_live_session(session, viewer, runtime_rpc: FakeRuntimeRPC)

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_leave_session_server,
                      [left_session_id, left_viewer_id], _opts}

      assert left_session_id == session.id
      assert left_viewer_id == viewer.id
    end

    test "remote leave removes the viewer from the local runtime" do
      host = user_fixture()
      viewer = user_fixture()
      session = live_session_fixture(host.id)

      on_exit(fn ->
        RealtimeRuntime.stop_session_runtime(session.id)
      end)

      assert {:ok, pid} = SessionSupervisor.start_session_server(session.id)
      assert :ok = SessionSupervisor.join_session_server(session.id, viewer.id, :viewer)
      assert %{participants: participants_before_leave} = LC.Live.SessionServer.snapshot(pid)
      assert Map.has_key?(participants_before_leave, viewer.id)

      assert :ok = Live.remote_leave_session_server(session.id, viewer.id)
      assert %{participants: participants_after_leave} = LC.Live.SessionServer.snapshot(pid)
      refute Map.has_key?(participants_after_leave, viewer.id)
    end
  end

  describe "end_live_session_with_transition/3 with remote runtime ownership" do
    test "routes remote stop through runtime RPC" do
      host = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)
      configure_runtime_rpc([{:ok, :ok}])

      assert {:ok, %LiveSession{id: session_id}, true} =
               Live.end_live_session_with_transition(
                 session,
                 %{ended_reason: :host_ended},
                 runtime_rpc: FakeRuntimeRPC
               )

      assert session_id == session.id

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_stop_session_server,
                      [stopped_session_id], _opts}

      assert stopped_session_id == session.id
    end

    test "remote stop terminates the local runtime" do
      host = user_fixture()
      session = live_session_fixture(host.id)

      assert {:ok, _pid} = SessionSupervisor.start_session_server(session.id)
      assert {:ok, _pid} = SessionSupervisor.lookup_session_server(session.id)

      assert :ok = Live.remote_stop_session_server(session.id)
      assert {:error, :not_found} = SessionSupervisor.lookup_session_server(session.id)
    end
  end

  describe "live_session_state_snapshot/2 with remote runtime ownership" do
    test "returns a bounded aggregate snapshot through runtime RPC" do
      host = user_fixture()
      session = live_session_fixture(host.id)
      remote_owner = "remote-owner@127.0.0.1"

      put_remote_owner(session, remote_owner)

      configure_runtime_rpc([
        {:ok, {:ok, %{status: :live, visibility: :public, viewer_count: 3}}}
      ])

      assert Live.live_session_state_snapshot(session, runtime_rpc: FakeRuntimeRPC) == %{
               status: :live,
               visibility: :public,
               viewer_count: 3
             }

      assert_receive {:runtime_rpc_call, ^remote_owner, Live, :remote_live_session_state_snapshot,
                      [remote_session_id], _opts}

      assert remote_session_id == session.id
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

  defp put_remote_owner(%LiveSession{id: session_id}, remote_owner)
       when is_integer(session_id) and is_binary(remote_owner) do
    shard_id = RealtimeRuntime.shard_id(session_id)
    put_remote_owner_for_shard(shard_id, remote_owner)

    on_exit(fn ->
      RealtimeRuntime.stop_session_runtime(session_id)
    end)

    :ok
  end

  defp put_remote_owner_for_shard(shard_id, remote_owner)
       when is_integer(shard_id) and is_binary(remote_owner) do
    :ok = RealtimeRuntime.put_test_shard_owner(shard_id, {:remote, remote_owner})

    on_exit(fn ->
      RealtimeRuntime.clear_test_shard_owner(shard_id)
    end)

    :ok
  end
end
