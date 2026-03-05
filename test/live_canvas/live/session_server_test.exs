defmodule LC.Live.SessionServerTest do
  use ExUnit.Case, async: true

  alias LC.Live.SessionServer

  test "tracks participant membership in memory" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    {:ok, pid} = start_supervised({SessionServer, session_id: session_id, registry: registry})

    assert :ok = SessionServer.join(pid, 101, :viewer)

    assert %{session_id: ^session_id, participants: participants} = SessionServer.snapshot(pid)
    assert %{role: :viewer, user_id: 101} = Map.fetch!(participants, 101)

    assert :ok = SessionServer.leave(pid, 101)
    assert %{participants: %{}} = SessionServer.snapshot(pid)
  end

  test "boots with initial participants when provided" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    initial_participants = %{
      101 => %{user_id: 101, role: :viewer, joined_at: ~U[2026-03-03 00:00:00.000000Z]}
    }

    {:ok, pid} =
      start_supervised(
        {SessionServer,
         session_id: session_id, registry: registry, initial_participants: initial_participants}
      )

    assert %{session_id: ^session_id, participants: participants} = SessionServer.snapshot(pid)
    assert participants == initial_participants
  end

  test "runs lease heartbeat callback on the configured interval" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")
    test_pid = self()

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    {:ok, _pid} =
      start_supervised(
        {SessionServer,
         session_id: session_id,
         registry: registry,
         lease_heartbeat: fn runtime_session_id ->
           send(test_pid, {:lease_heartbeat, runtime_session_id})
           :ok
         end,
         lease_heartbeat_interval_ms: 5}
      )

    assert_receive {:lease_heartbeat, ^session_id}
  end

  test "stops when lease heartbeat callback reports lost ownership" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    {:ok, pid} =
      start_supervised(
        {SessionServer,
         session_id: session_id,
         registry: registry,
         lease_heartbeat: fn _runtime_session_id -> {:error, :lost_ownership} end,
         lease_heartbeat_interval_ms: 5}
      )

    monitor_ref = Process.monitor(pid)
    assert_receive {:DOWN, ^monitor_ref, :process, ^pid, :lost_ownership}, 1_000
  end
end
