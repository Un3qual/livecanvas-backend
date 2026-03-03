defmodule LCWeb.LiveSessionChannelTest do
  use LC.DataCase, async: false
  import Phoenix.ChannelTest

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.Infra.Repo
  alias LC.Live
  alias LCSchemas.Chat.ChatMessage
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

  defp socket_for(user) do
    socket(UserSocket, "user_socket:#{user.id}", %{current_user: user})
  end
end
