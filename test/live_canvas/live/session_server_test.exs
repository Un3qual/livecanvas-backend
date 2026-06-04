defmodule LC.Live.SessionServerTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

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

  test "starts media negotiation as not ready" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    {:ok, pid} = start_supervised({SessionServer, session_id: session_id, registry: registry})

    assert {:not_ready, :media_not_ready} = SessionServer.media_negotiation_ready?(pid)
  end

  test "marks media negotiation ready in memory" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    {:ok, pid} = start_supervised({SessionServer, session_id: session_id, registry: registry})

    assert :ok = SessionServer.mark_media_negotiation_ready(pid)
    assert :ready = SessionServer.media_negotiation_ready?(pid)
  end

  test "readiness calls return not_found when the runtime exits before call" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})
    {:ok, pid} = start_supervised({SessionServer, session_id: session_id, registry: registry})

    monitor_ref = Process.monitor(pid)
    Process.exit(pid, :kill)
    assert_receive {:DOWN, ^monitor_ref, :process, ^pid, :killed}

    assert {:error, :not_found} = SessionServer.media_negotiation_ready?(pid)
    assert {:error, :not_found} = SessionServer.mark_media_negotiation_ready(pid)
  end

  test "readiness calls do not convert server crashes into not_found" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})
    {:ok, pid} = start_supervised({SessionServer, session_id: session_id, registry: registry})

    :sys.replace_state(pid, fn _state -> :corrupt_state end)

    assert capture_log(fn ->
             assert {{{:badmap, :corrupt_state}, _stacktrace}, _call} =
                      catch_exit(SessionServer.mark_media_negotiation_ready(pid))
           end) =~ "terminating"
  end
end
