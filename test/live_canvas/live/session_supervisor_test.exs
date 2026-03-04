defmodule LC.Live.SessionSupervisorTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live.{SessionOwnership, SessionSupervisor}
  alias LCSchemas.Live.{LiveSession, LiveSessionRuntimeOwner}

  describe "start_session_server/2" do
    test "claims local ownership when starting a session runtime" do
      session_id = live_session_id_fixture()

      assert {:ok, pid} = SessionSupervisor.start_session_server(session_id)
      assert Process.alive?(pid)
      assert {:ok, owner_node} = SessionOwnership.get_owner(session_id, now_utc())
      assert owner_node == local_node_name()
      assert :ok = SessionSupervisor.stop_session_server(session_id)
    end

    test "returns owned_by_remote when another node has an active lease" do
      session_id = live_session_id_fixture()
      remote_owner = "remote-a@127.0.0.1"

      assert {:ok, _lease} = SessionOwnership.claim(session_id, remote_owner, now_utc())

      assert {:error, {:owned_by_remote, ^remote_owner}} =
               SessionSupervisor.start_session_server(session_id)
    end

    test "takes over an expired remote lease before starting runtime" do
      session_id = live_session_id_fixture()
      remote_owner = "remote-a@127.0.0.1"
      stale_claimed_at = DateTime.add(now_utc(), -120, :second)

      assert {:ok, _lease} = SessionOwnership.claim(session_id, remote_owner, stale_claimed_at)

      assert {:ok, pid} = SessionSupervisor.start_session_server(session_id)
      assert Process.alive?(pid)
      assert {:ok, owner_node} = SessionOwnership.get_owner(session_id, now_utc())
      assert owner_node == local_node_name()
      assert :ok = SessionSupervisor.stop_session_server(session_id)
    end
  end

  describe "lookup_session_server/1" do
    test "returns owned_by_remote when a remote node holds an active lease" do
      session_id = live_session_id_fixture()
      remote_owner = "remote-b@127.0.0.1"

      assert {:ok, _lease} = SessionOwnership.claim(session_id, remote_owner, now_utc())

      assert {:error, {:owned_by_remote, ^remote_owner}} =
               SessionSupervisor.lookup_session_server(session_id)
    end
  end

  describe "stop_session_server/1" do
    test "releases local ownership lease on stop" do
      session_id = live_session_id_fixture()

      assert {:ok, _pid} = SessionSupervisor.start_session_server(session_id)
      assert {:ok, _owner_node} = SessionOwnership.get_owner(session_id, now_utc())

      assert :ok = SessionSupervisor.stop_session_server(session_id)
      assert {:error, :not_found} = SessionOwnership.get_owner(session_id, now_utc())
    end
  end

  describe "lease heartbeats" do
    test "refreshes lease heartbeat while runtime is active" do
      session_id = live_session_id_fixture()
      heartbeat_interval_ms = 20

      assert {:ok, pid} =
               SessionSupervisor.start_session_server(
                 session_id,
                 %{},
                 lease_heartbeat_interval_ms: heartbeat_interval_ms
               )

      :ok = allow_runtime_db(pid)
      first_lease = Repo.get_by!(LiveSessionRuntimeOwner, live_session_id: session_id)

      Process.sleep(heartbeat_interval_ms * 4)

      refreshed_lease = Repo.get_by!(LiveSessionRuntimeOwner, live_session_id: session_id)

      assert DateTime.compare(refreshed_lease.heartbeat_at, first_lease.heartbeat_at) == :gt

      assert DateTime.compare(refreshed_lease.lease_expires_at, first_lease.lease_expires_at) ==
               :gt

      assert :ok = SessionSupervisor.stop_session_server(session_id)
    end

    test "stops runtime when lease refresh can no longer confirm ownership" do
      session_id = live_session_id_fixture()
      heartbeat_interval_ms = 20

      assert {:ok, pid} =
               SessionSupervisor.start_session_server(
                 session_id,
                 %{},
                 lease_heartbeat_interval_ms: heartbeat_interval_ms
               )

      :ok = allow_runtime_db(pid)
      lease = Repo.get_by!(LiveSessionRuntimeOwner, live_session_id: session_id)
      _deleted_lease = Repo.delete!(lease)
      monitor_ref = Process.monitor(pid)

      assert_receive {:DOWN, ^monitor_ref, :process, ^pid, :lost_ownership}
      assert {:error, :not_found} = SessionSupervisor.lookup_session_server(session_id)
    end
  end

  defp live_session_id_fixture do
    host = user_fixture()
    live_session = Repo.insert!(%LiveSession{host_id: host.id})
    live_session.id
  end

  defp local_node_name, do: Node.self() |> Atom.to_string()

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)

  defp allow_runtime_db(pid) when is_pid(pid) do
    Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid)
  end
end
