defmodule LC.RealtimeRuntimeTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live.SessionServer
  alias LC.RealtimeRuntime
  alias LCSchemas.Live.LiveSession

  describe "shard_id/2" do
    test "calculates stable shard keys for session IDs" do
      assert RealtimeRuntime.shard_id(42) == RealtimeRuntime.shard_id(42)
      assert RealtimeRuntime.shard_id(42, shard_count: 8) == 2
      assert RealtimeRuntime.shard_id(43, shard_count: 8) == 3
    end
  end

  describe "lookup_session_runtime/2" do
    test "returns not_found when no owner exists for the shard" do
      session_id = live_session_id_fixture()

      assert {:error, :not_found} =
               RealtimeRuntime.lookup_session_runtime(session_id, shard_id: 999)
    end
  end

  describe "start_session_runtime/3" do
    test "starts and looks up a runtime on a locally owned shard" do
      session_id = live_session_id_fixture()

      assert {:ok, pid} = RealtimeRuntime.start_session_runtime(session_id)
      assert Process.alive?(pid)
      assert {:ok, ^pid} = RealtimeRuntime.lookup_session_runtime(session_id)

      assert :ok = RealtimeRuntime.stop_session_runtime(session_id)
    end

    test "routes duplicate starts for the same session to the existing runtime" do
      session_id = live_session_id_fixture()
      joined_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

      initial_participants = %{
        101 => %{user_id: 101, role: :viewer, joined_at: joined_at}
      }

      assert {:ok, pid} = RealtimeRuntime.start_session_runtime(session_id, initial_participants)
      assert {:ok, ^pid} = RealtimeRuntime.start_session_runtime(session_id, %{})

      assert %{participants: participants} = SessionServer.snapshot(pid)
      assert Map.has_key?(participants, 101)

      assert :ok = RealtimeRuntime.stop_session_runtime(session_id)
    end

    test "does not start a duplicate local runtime when shard ownership is unavailable" do
      session_id = live_session_id_fixture()

      assert {:error, :not_found} =
               RealtimeRuntime.start_session_runtime(session_id, %{}, shard_id: 999)

      assert {:error, :not_found} =
               RealtimeRuntime.lookup_session_runtime(session_id, shard_id: 999)
    end
  end

  defp live_session_id_fixture do
    host = user_fixture()
    live_session = Repo.insert!(%LiveSession{host_id: host.id})
    live_session.id
  end
end
