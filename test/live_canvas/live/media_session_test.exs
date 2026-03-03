defmodule LC.Live.MediaSessionTest do
  use ExUnit.Case, async: true

  alias LC.Live.MediaSession
  alias LCSchemas.Live.LiveSession

  test "start_for_session/1 returns :ok for a live session placeholder" do
    session = %LiveSession{id: System.unique_integer([:positive])}

    assert :ok = MediaSession.start_for_session(session)
  end
end
