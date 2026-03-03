defmodule LC.Integration.LiveSessionFlowTest do
  use LCWeb.ConnCase, async: false

  import Phoenix.ChannelTest
  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.Live
  alias LCWeb.{LiveSessionChannel, UserSocket}

  @endpoint LCWeb.Endpoint

  test "host starts live session, follower joins topic, chat message is delivered" do
    host = user_fixture(privacy_mode: :public)
    follower = user_fixture()
    _follow = accepted_follow_fixture(follower, host)

    {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})
    {:ok, live_session} = Live.mark_session_live(started_session)

    socket =
      UserSocket
      |> socket("user_socket:#{follower.id}", %{})
      |> authenticated_socket(follower)

    assert {:ok, _join_payload, live_socket} =
             subscribe_and_join(
               socket,
               LiveSessionChannel,
               "live_session:#{live_session.id}"
             )

    ref = Phoenix.ChannelTest.push(live_socket, "chat:send", %{"body" => "integration hello"})

    assert_reply ref, :ok, %{
      message: %{id: message_id, body: "integration hello", sender_id: sender_id}
    }

    assert sender_id == follower.id

    assert_broadcast "chat:message", %{
      message: %{id: ^message_id, body: "integration hello", sender_id: ^sender_id}
    }
  end
end
