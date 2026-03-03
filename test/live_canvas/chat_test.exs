defmodule LC.ChatTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Chat, Live}
  alias LCSchemas.Chat.ChatMessage

  describe "authorize_join/2" do
    test "allows a followed viewer to join a followers-only session" do
      host = user_fixture()
      viewer = user_fixture()
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert :ok = Chat.authorize_join(viewer, session)
    end
  end

  describe "create_message/3" do
    test "persists a chat message for the live session" do
      host = user_fixture()
      viewer = user_fixture()
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert :ok = Chat.authorize_join(viewer, session)
      assert {:ok, message} = Chat.create_message(session, viewer, %{body: "hello"})
      assert message.live_session_id == session.id
      assert message.sender_id == viewer.id
      assert message.body == "hello"
      assert message.kind == :user_message
      assert is_binary(message.entropy_id)

      assert %ChatMessage{id: persisted_id} = Repo.get!(ChatMessage, message.id)
      assert persisted_id == message.id
    end
  end
end
