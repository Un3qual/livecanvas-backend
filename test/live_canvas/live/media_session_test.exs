defmodule LC.Live.MediaSessionTest do
  use ExUnit.Case, async: true

  alias LC.Live.MediaSession
  alias LC.Live.SessionServer
  alias LCSchemas.Live.LiveSession

  test "start_for_session/1 returns :ok for a live session placeholder" do
    session = %LiveSession{id: System.unique_integer([:positive])}

    assert :ok = MediaSession.start_for_session(session)
  end

  test "session server delegates media bootstrap during startup" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")
    test_pid = self()

    media_bootstrap = fn %LiveSession{} = session ->
      send(test_pid, {:media_bootstrap_called, session})
      :ok
    end

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    assert {:ok, _pid} =
             start_supervised(
               {SessionServer,
                session_id: session_id, registry: registry, media_bootstrap: media_bootstrap}
             )

    assert_receive {:media_bootstrap_called, %LiveSession{id: ^session_id}}
  end

  test "session server startup fails when media bootstrap returns an error" do
    session_id = System.unique_integer([:positive])
    registry = Module.concat(__MODULE__, "Registry#{session_id}")

    media_bootstrap = fn %LiveSession{} -> {:error, :pipeline_unavailable} end

    {:ok, _registry_pid} = start_supervised({Registry, keys: :unique, name: registry})

    assert {:error, {{:media_bootstrap_failed, :pipeline_unavailable}, _child_spec}} =
             start_supervised(
               {SessionServer,
                session_id: session_id, registry: registry, media_bootstrap: media_bootstrap}
             )
  end
end
