defmodule LC.LiveTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Live

  describe "start_live_session/2" do
    test "creates a starting session and boots a session server" do
      host = user_fixture()

      assert {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      assert session.host_id == host.id
      assert session.status == :starting
      assert session.visibility == :followers
      assert is_binary(session.entropy_id)

      assert {:ok, pid} = Live.lookup_session_server(session.id)
      assert Process.alive?(pid)
    end
  end

  describe "mark_session_live/1" do
    test "transitions the session to live with a started_at timestamp" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, live_session} = Live.mark_session_live(session)
      assert live_session.status == :live
      assert %DateTime{} = live_session.started_at
    end

    test "does not transition an ended session back to live" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})

      assert {:error, changeset} = Live.mark_session_live(ended_session)
      assert %{status: ["cannot transition ended session to live"]} = errors_on(changeset)
    end
  end

  describe "join_live_session/3 and end_live_session/2" do
    test "persists participant joins and shuts down the runtime process when ended" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, participant} = Live.join_live_session(session, viewer, :viewer)
      assert participant.live_session_id == session.id
      assert participant.user_id == viewer.id
      assert participant.role == :viewer
      assert is_binary(participant.entropy_id)

      assert {:ok, pid} = Live.lookup_session_server(session.id)
      monitor_ref = Process.monitor(pid)

      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})
      assert ended_session.status == :ended
      assert ended_session.ended_reason == :host_ended
      assert %DateTime{} = ended_session.ended_at

      assert_receive {:DOWN, ^monitor_ref, :process, ^pid, _reason}
    end

    test "returns an error when joining an ended session" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})
      assert ended_session.status == :ended

      assert {:error, :ended} = Live.join_live_session(ended_session, viewer, :viewer)
    end
  end
end
