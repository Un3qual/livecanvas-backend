defmodule LCWeb.LiveSessionChannelTest do
  use LC.DataCase, async: false
  import Phoenix.ChannelTest

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.Infra.Repo
  alias LC.Live
  alias LC.Live.SessionServer
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Live.LiveParticipant
  alias LCWeb.{LiveSessionChannel, UserSocket}

  @endpoint LCWeb.Endpoint

  test "authorized viewer can join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, _socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )
  end

  test "sending chat:send persists and broadcasts the message" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    ref = push(socket, "chat:send", %{"body" => "hello"})

    assert_reply ref, :ok, %{message: %{body: "hello", id: message_id}}
    assert_broadcast "chat:message", %{message: %{body: "hello", id: ^message_id}}
    assert %ChatMessage{id: ^message_id, body: "hello"} = Repo.get!(ChatMessage, message_id)
  end

  test "viewer who muted host cannot join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    _mute = mute_fixture(viewer, host)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:error, %{reason: "not_authorized"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )
  end

  test "disconnect marks participant left and prunes runtime membership" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert {:ok, pid} = Live.lookup_session_server(session.id)
    assert %{participants: participants_before_leave} = SessionServer.snapshot(pid)
    assert Map.has_key?(participants_before_leave, viewer.id)

    assert :ok = close(socket)
    assert :ok = wait_for_participant_left(session.id, viewer.id)

    assert %LiveParticipant{left_at: %DateTime{}} =
             Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

    assert %{participants: participants_after_leave} = SessionServer.snapshot(pid)
    refute Map.has_key?(participants_after_leave, viewer.id)
  end

  defp socket_for(user) do
    socket(UserSocket, "user_socket:#{user.id}", %{current_user: user})
  end

  defp wait_for_participant_left(session_id, user_id, attempts \\ 30)
  defp wait_for_participant_left(_session_id, _user_id, 0), do: flunk("participant row not marked left")

  defp wait_for_participant_left(session_id, user_id, attempts) do
    case Repo.get_by(LiveParticipant, live_session_id: session_id, user_id: user_id) do
      %LiveParticipant{left_at: %DateTime{}} ->
        :ok

      _other ->
        Process.sleep(10)
        wait_for_participant_left(session_id, user_id, attempts - 1)
    end
  end
end
