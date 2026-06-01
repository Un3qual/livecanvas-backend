defmodule LC.ChatTimelineTest do
  use LC.DataCase, async: true

  import Ecto.Query
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

  describe "edit_timeline_chat_message/3" do
    test "records multiple edit facts and exposes one latest-body projection" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, original} = Chat.create_timeline_chat_message(session, sender, %{body: "helo world"})

      assert {:ok, first_edit} =
               Chat.edit_timeline_chat_message(original, sender, %{body: "hello world"})

      assert first_edit.id == original.id
      assert first_edit.body == "hello world"
      assert first_edit.edited == true
      assert first_edit.edit_count == 1
      assert is_struct(first_edit.edited_at, DateTime)

      assert {:ok, second_edit} =
               Chat.edit_timeline_chat_message(original, sender, %{body: "hello, world"})

      assert second_edit.id == original.id
      assert second_edit.body == "hello, world"
      assert second_edit.edit_count == 2

      assert [%{id: projected_id, body: "hello, world", edit_count: 2}] =
               session
               |> Chat.timeline_history_query()
               |> Chat.run_query()

      assert projected_id == original.id

      edit_events =
        from(event in LiveSessionTimelineEvent,
          where:
            event.live_session_id == ^session.id and
              event.event_type == :chat_message_edited and
              event.target_event_id == ^original.id,
          order_by: [asc: event.occurred_at, asc: event.id]
        )
        |> Repo.all()

      assert length(edit_events) == 2
    end

    test "denies edits from non-senders" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      other = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, original} = Chat.create_timeline_chat_message(session, sender, %{body: "nope"})

      assert {:error, :not_authorized} =
               Chat.edit_timeline_chat_message(original, other, %{body: "stolen"})
    end

    test "denies edits after the live session ends" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, original} = Chat.create_timeline_chat_message(session, host, %{body: "closed"})
      {:ok, _ended_session} = Live.end_live_session(session)

      assert {:error, :session_ended} =
               Chat.edit_timeline_chat_message(original, host, %{body: "too late"})
    end

    test "denies edits for hidden message projections" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, original} = Chat.create_timeline_chat_message(session, sender, %{body: "hidden"})

      LiveSessionTimelineEventState
      |> Repo.get!(original.id)
      |> Ecto.Changeset.change(
        projection_state: :hidden,
        updated_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
      )
      |> Repo.update!()

      assert {:error, :hidden} =
               Chat.edit_timeline_chat_message(original, sender, %{body: "still hidden"})
    end
  end
end
