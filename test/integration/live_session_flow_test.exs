defmodule LC.Integration.LiveSessionFlowTest do
  use LCWeb.ConnCase, async: false

  import Phoenix.ChannelTest
  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.Live
  alias LCTransport.LiveSessionTopics
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
               LiveSessionTopics.live_session_topic(live_session.id)
             )

    ref =
      Phoenix.ChannelTest.push(live_socket, "timeline:chat_message:send", %{
        "body" => "integration hello"
      })

    assert_reply ref, :ok, %{
      event: %{id: event_id, body: "integration hello", actor_id: sender_id}
    }

    assert sender_id == follower.id

    assert_broadcast "timeline:event", %{
      event: %{id: ^event_id, body: "integration hello", actor_id: ^sender_id}
    }
  end
end
