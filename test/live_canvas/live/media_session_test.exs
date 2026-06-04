defmodule LC.Live.MediaSessionTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Live
  alias LC.Live.LiveSession, as: LiveSessionChanges
  alias LC.Live.MediaSession
  alias LC.Live.SessionSupervisor
  alias LC.Live.SessionServer
  alias LCSchemas.Live.{LiveMediaSession, LiveSession}

  describe "durable media readiness" do
    test "creates a not-ready media session row for the host" do
      host = user_fixture()
      live_session = live_session_fixture(host)

      assert {:ok,
              %LiveMediaSession{
                live_session_id: live_session_id,
                readiness_state: :not_ready,
                ready_at: nil,
                entropy_id: entropy_id
              }} = MediaSession.ensure_readiness(live_session, host)

      assert live_session_id == live_session.id
      assert is_binary(entropy_id)

      assert %LiveMediaSession{readiness_state: :not_ready, ready_at: nil} =
               Repo.get_by!(LiveMediaSession, live_session_id: live_session.id)

      assert {:not_ready, :media_not_ready} = MediaSession.readiness(live_session)
    end

    test "marks readiness durable and keeps the live context readable after runtime stop" do
      host = user_fixture()

      assert {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})
      assert {:not_ready, :media_not_ready} = Live.media_negotiation_ready?(live_session.id)

      assert :ok = Live.mark_media_negotiation_ready(live_session.id)
      assert :ready = Live.media_negotiation_ready?(live_session.id)

      assert :ok = SessionSupervisor.stop_session_server(live_session.id)
      assert :ready = Live.media_negotiation_ready?(live_session.id)
    end

    test "resets readiness back to not-ready and clears ready_at" do
      host = user_fixture()
      live_session = live_session_fixture(host)

      assert {:ok, %LiveMediaSession{ready_at: %DateTime{}}} =
               MediaSession.mark_ready(live_session, host)

      assert {:ok, %LiveMediaSession{readiness_state: :not_ready, ready_at: nil}} =
               MediaSession.reset_readiness(live_session, host)

      assert {:not_ready, :media_not_ready} = MediaSession.readiness(live_session.id)
    end

    test "rejects non-host callers without changing durable readiness" do
      host = user_fixture()
      viewer = user_fixture()
      live_session = live_session_fixture(host)

      assert {:ok, %LiveMediaSession{}} = MediaSession.ensure_readiness(live_session, host)

      assert {:error, :not_authorized} = MediaSession.mark_ready(live_session, viewer)
      assert {:not_ready, :media_not_ready} = MediaSession.readiness(live_session)
    end

    test "rejects terminal sessions using the current persisted state" do
      host = user_fixture()
      live_session = live_session_fixture(host)

      assert {:ok, %LiveMediaSession{}} = MediaSession.ensure_readiness(live_session, host)

      live_session
      |> LiveSessionChanges.end_changeset(
        %{},
        DateTime.utc_now() |> DateTime.truncate(:microsecond)
      )
      |> Repo.update!()

      assert {:error, :ended} = MediaSession.mark_ready(live_session, host)
      assert {:not_ready, :media_not_ready} = MediaSession.readiness(live_session.id)
    end
  end

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

  defp live_session_fixture(host, attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        host_id: host.id,
        status: :starting,
        visibility: :followers
      })

    %LiveSession{}
    |> LiveSessionChanges.changeset(attrs)
    |> Repo.insert!()
  end
end
