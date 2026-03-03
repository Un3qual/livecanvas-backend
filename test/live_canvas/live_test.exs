defmodule LC.LiveTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Live
  alias LC.Live.SessionServer
  alias LCSchemas.Live.LiveParticipant

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

    test "rehydrates participants when recreating a missing session server" do
      host = user_fixture()
      first_viewer = user_fixture()
      second_viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, _participant} = Live.join_live_session(session, first_viewer, :viewer)
      assert {:ok, stale_pid} = Live.lookup_session_server(session.id)

      monitor_ref = Process.monitor(stale_pid)
      Process.exit(stale_pid, :kill)
      assert_receive {:DOWN, ^monitor_ref, :process, ^stale_pid, _reason}
      assert :ok = wait_for_session_server_down(session.id)

      assert {:ok, _participant} = Live.join_live_session(session, second_viewer, :viewer)
      assert {:ok, restarted_pid} = Live.lookup_session_server(session.id)
      refute restarted_pid == stale_pid

      assert %{participants: participants} = SessionServer.snapshot(restarted_pid)
      first_viewer_id = first_viewer.id
      second_viewer_id = second_viewer.id

      assert Map.keys(participants) |> Enum.sort() == [first_viewer_id, second_viewer_id]

      assert %{user_id: ^first_viewer_id, role: :viewer} =
               Map.fetch!(participants, first_viewer_id)

      assert %{user_id: ^second_viewer_id, role: :viewer} =
               Map.fetch!(participants, second_viewer_id)
    end

    test "marks participant left_at and removes runtime membership on leave" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)
      assert {:ok, pid} = Live.lookup_session_server(session.id)
      assert %{participants: participants_before_leave} = SessionServer.snapshot(pid)
      assert Map.has_key?(participants_before_leave, viewer.id)

      assert :ok = Live.leave_live_session(session, viewer)

      assert %LiveParticipant{left_at: %DateTime{} = left_at} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

      assert DateTime.compare(left_at, DateTime.utc_now()) in [:lt, :eq]
      assert %{participants: participants_after_leave} = SessionServer.snapshot(pid)
      refute Map.has_key?(participants_after_leave, viewer.id)
    end

    test "leaving a session is idempotent for already-left participants" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)
      assert :ok = Live.leave_live_session(session, viewer)

      assert %LiveParticipant{left_at: %DateTime{} = first_left_at} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

      assert :ok = Live.leave_live_session(session, viewer)

      assert %LiveParticipant{left_at: ^first_left_at} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)
    end
  end

  defp wait_for_session_server_down(session_id, attempts \\ 20)
  defp wait_for_session_server_down(_session_id, 0), do: flunk("session server did not stop")

  defp wait_for_session_server_down(session_id, attempts) do
    case Live.lookup_session_server(session_id) do
      {:error, :not_found} ->
        :ok

      {:ok, _pid} ->
        Process.sleep(10)
        wait_for_session_server_down(session_id, attempts - 1)
    end
  end
end
