defmodule LC.RealtimeRuntimeTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live.SessionServer
  alias LC.RealtimeRuntime
  alias LC.RealtimeRuntime.ShardOwner
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

  describe "runtime supervisor startup" do
    test "accepts custom shard init options without passing them as supervisor start options" do
      custom_shard_id = unique_shard_id()

      stop_default_runtime_supervisor()

      on_exit(fn ->
        restart_default_runtime_supervisor()
      end)

      assert {:ok, supervisor_pid} =
               RealtimeRuntime.Supervisor.start_link(
                 name: :"test_realtime_runtime_supervisor_#{custom_shard_id}",
                 shard_ids: [custom_shard_id]
               )

      assert Process.alive?(supervisor_pid)
      assert is_pid(:global.whereis_name(RealtimeRuntime.global_shard_name(custom_shard_id)))

      Supervisor.stop(supervisor_pid)
    end
  end

  describe "shard owner standby registration" do
    test "an unnamed standby claims the global shard name after the owner exits" do
      Process.flag(:trap_exit, true)

      shard_id = unique_shard_id()
      global_name = RealtimeRuntime.global_shard_name(shard_id)

      assert {:ok, owner_pid} =
               ShardOwner.start_link(
                 shard_id: shard_id,
                 global_claim_retry_interval_ms: 10
               )

      assert :global.whereis_name(global_name) == owner_pid

      assert {:ok, standby_pid} =
               ShardOwner.start_link(
                 shard_id: shard_id,
                 global_claim_retry_interval_ms: 10
               )

      assert standby_pid != owner_pid
      assert :global.whereis_name(global_name) == owner_pid

      Process.exit(owner_pid, :kill)
      assert_receive {:EXIT, ^owner_pid, :killed}

      assert_eventually(fn ->
        :global.whereis_name(global_name) == standby_pid
      end)

      Process.exit(standby_pid, :kill)
      assert_receive {:EXIT, ^standby_pid, :killed}
    end
  end

  defp live_session_id_fixture do
    host = user_fixture()
    live_session = Repo.insert!(%LiveSession{host_id: host.id})
    live_session.id
  end

  defp unique_shard_id do
    System.unique_integer([:positive, :monotonic]) + 10_000
  end

  defp stop_default_runtime_supervisor do
    case Process.whereis(RealtimeRuntime.Supervisor) do
      nil ->
        :ok

      _pid ->
        assert :ok = Supervisor.terminate_child(LC.Supervisor, RealtimeRuntime.Supervisor)
    end
  end

  defp restart_default_runtime_supervisor do
    case Process.whereis(RealtimeRuntime.Supervisor) do
      nil ->
        assert {:ok, _pid} = Supervisor.restart_child(LC.Supervisor, RealtimeRuntime.Supervisor)
        :ok

      _pid ->
        :ok
    end
  end

  defp assert_eventually(assertion, attempts \\ 25)

  defp assert_eventually(_assertion, 0), do: flunk("condition was not met before timeout")

  defp assert_eventually(assertion, attempts) when is_function(assertion, 0) do
    if assertion.() do
      :ok
    else
      Process.sleep(20)
      assert_eventually(assertion, attempts - 1)
    end
  end
end
