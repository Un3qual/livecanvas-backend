defmodule LC.Live.SessionSupervisorTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live.{SessionServer, SessionSupervisor}
  alias LCSchemas.Live.LiveSession

  describe "start_session_server/2" do
    test "starts a local session runtime through the realtime runtime layer" do
      session_id = live_session_id_fixture()

      assert {:ok, pid} = SessionSupervisor.start_session_server(session_id)
      assert Process.alive?(pid)
      assert {:ok, ^pid} = SessionSupervisor.lookup_session_server(session_id)
      assert :ok = SessionSupervisor.stop_session_server(session_id)
    end

    test "routes duplicate starts for the same session to the existing runtime" do
      session_id = live_session_id_fixture()

      assert {:ok, pid} = SessionSupervisor.start_session_server(session_id)
      assert {:ok, ^pid} = SessionSupervisor.start_session_server(session_id)

      assert :ok = SessionSupervisor.stop_session_server(session_id)
    end

    test "returns not_found when the selected shard has no owner" do
      session_id = live_session_id_fixture()

      assert {:error, :not_found} =
               SessionSupervisor.start_session_server(session_id, %{}, shard_id: 999)
    end
  end

  describe "lookup_session_server/1" do
    test "returns not_found for a missing runtime on an owned shard" do
      session_id = live_session_id_fixture()

      assert {:error, :not_found} = SessionSupervisor.lookup_session_server(session_id)
    end
  end

  describe "join_session_server/3" do
    test "joins the in-memory runtime when it exists" do
      session_id = live_session_id_fixture()

      assert {:ok, pid} = SessionSupervisor.start_session_server(session_id)
      assert :ok = SessionSupervisor.join_session_server(session_id, 101, :viewer)
      assert %{participants: participants} = SessionServer.snapshot(pid)
      assert %{role: :viewer, user_id: 101} = Map.fetch!(participants, 101)

      assert :ok = SessionSupervisor.stop_session_server(session_id)
    end
  end

  describe "stop_session_server/1" do
    test "stops local runtime state idempotently" do
      session_id = live_session_id_fixture()

      assert {:ok, _pid} = SessionSupervisor.start_session_server(session_id)
      assert :ok = SessionSupervisor.stop_session_server(session_id)
      assert :ok = SessionSupervisor.stop_session_server(session_id)
      assert {:error, :not_found} = SessionSupervisor.lookup_session_server(session_id)
    end
  end

  defp live_session_id_fixture do
    host = user_fixture()
    live_session = Repo.insert!(%LiveSession{host_id: host.id})
    live_session.id
  end
end
