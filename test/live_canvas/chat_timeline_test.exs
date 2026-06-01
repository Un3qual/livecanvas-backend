defmodule LC.ChatTimelineTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Live}

  alias LCSchemas.Chat.{
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState
  }

  describe "create_timeline_chat_message/3" do
    test "persists an append-only chat event and visible current projection" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "hello"})

      assert event.event_type == :chat_message_sent
      assert event.live_session_id == session.id
      assert event.actor_user_id == sender.id
      assert event.body == "hello"
      assert event.edited == false
      assert event.edit_count == 0
      assert event.edited_at == nil

      assert %LiveSessionTimelineEvent{event_type: :chat_message_sent} =
               Repo.get!(LiveSessionTimelineEvent, event.id)

      assert %LiveSessionTimelineChatMessage{body: "hello"} =
               Repo.get!(LiveSessionTimelineChatMessage, event.id)

      assert %LiveSessionTimelineChatMessageState{current_body: "hello", edit_count: 0} =
               Repo.get!(LiveSessionTimelineChatMessageState, event.id)

      assert %LiveSessionTimelineEventState{projection_state: :visible} =
               Repo.get!(LiveSessionTimelineEventState, event.id)
    end

    test "history projection returns visible events in occurred_at and id order" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      {:ok, first} = Chat.create_timeline_chat_message(session, host, %{body: "first"})
      {:ok, second} = Chat.create_timeline_chat_message(session, viewer, %{body: "second"})

      assert :ok = Chat.authorize_history_access(viewer, session)

      assert [%{id: first_id, body: "first"}, %{id: second_id, body: "second"}] =
               session |> Chat.timeline_history_query() |> Chat.run_query()

      assert first_id == first.id
      assert second_id == second.id
    end

    test "keeps existing history visibility policy" do
      host = user_fixture()
      follower = user_fixture()
      outsider = user_fixture()
      _follow = accepted_follow_fixture(follower, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, event} = Chat.create_timeline_chat_message(session, follower, %{body: "visible"})
      {:ok, ended_session} = Live.end_live_session(session)

      assert :ok = Chat.authorize_history_access(follower, ended_session)
      assert {:error, :not_authorized} = Chat.authorize_history_access(outsider, ended_session)

      assert %{id: event_id, body: "visible"} = Chat.get_timeline_event(follower, event.id)
      assert event_id == event.id
      assert Chat.get_timeline_event(outsider, event.id) == nil
    end

    test "denies sends from suspended viewers" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _sender} = Accounts.suspend_user(sender)

      assert {:error, :not_authorized} =
               Chat.create_timeline_chat_message(session, sender, %{body: "blocked"})
    end
  end
end
