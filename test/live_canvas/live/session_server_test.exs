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
end
