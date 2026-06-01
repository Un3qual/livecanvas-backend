defmodule LC.ChatTimelineTest do
  use LC.DataCase, async: true

  import Ecto.Query
  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Live}

  alias LCSchemas.Chat.{
    LiveSessionModerationAction,
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageEdit,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState,
    LiveSessionTimelineModerationEvent
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

    test "re-reads session state before accepting sends from stale callers" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _ended_session} = Live.end_live_session(session)

      assert {:error, :session_ended} =
               Chat.create_timeline_chat_message(session, host, %{body: "too late"})

      assert 0 ==
               from(timeline_event in LiveSessionTimelineEvent,
                 where:
                   timeline_event.live_session_id == ^session.id and
                     timeline_event.event_type == :chat_message_sent
               )
               |> Repo.aggregate(:count)
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
      assert [first_edit_event, second_edit_event] = edit_events

      edit_facts =
        from(edit in LiveSessionTimelineChatMessageEdit,
          where: edit.timeline_event_id in ^[first_edit_event.id, second_edit_event.id]
        )
        |> Repo.all()
        |> Map.new(&{&1.timeline_event_id, &1})

      assert map_size(edit_facts) == 2

      assert %LiveSessionTimelineChatMessageEdit{
               target_event_id: first_target_event_id,
               previous_body: "helo world",
               new_body: "hello world"
             } = Map.fetch!(edit_facts, first_edit_event.id)

      assert first_target_event_id == original.id

      assert %LiveSessionTimelineChatMessageEdit{
               target_event_id: second_target_event_id,
               previous_body: "hello world",
               new_body: "hello, world"
             } = Map.fetch!(edit_facts, second_edit_event.id)

      assert second_target_event_id == original.id
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

    test "locks session and projection state before accepting edits" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, original} = Chat.create_timeline_chat_message(session, sender, %{body: "unlocked"})

      {result, queries} =
        capture_repo_queries(fn ->
          Chat.edit_timeline_chat_message(original, sender, %{body: "locked"})
        end)

      assert {:ok, %{body: "locked"}} = result

      assert Enum.any?(queries, fn query ->
               String.contains?(query, ~s(FROM "live_session_timeline_event_states")) and
                 String.contains?(query, "FOR UPDATE")
             end)

      assert Enum.any?(queries, fn query ->
               String.contains?(query, ~s(FROM "live_sessions")) and
                 String.contains?(query, "FOR UPDATE")
             end)
    end
  end

  describe "remove_timeline_chat_message/3" do
    test "hides the original message from future history and records internal removal fact" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, first} = Chat.create_timeline_chat_message(session, sender, %{body: "remove"})
      {:ok, _second} = Chat.create_timeline_chat_message(session, host, %{body: "keep"})

      assert {:ok, %{removed_event_id: removed_id, transitioned?: true}} =
               Chat.remove_timeline_chat_message(first, host, %{
                 reason_code: "abuse",
                 internal_note: "reported by viewers"
               })

      assert removed_id == first.id

      assert [%{body: "keep"}] =
               session
               |> Chat.timeline_history_query()
               |> Chat.run_query()

      assert %LiveSessionTimelineEventState{
               projection_state: :hidden,
               superseded_by_event_id: removal_event_id,
               moderation_action_id: moderation_action_id
             } = Repo.get!(LiveSessionTimelineEventState, first.id)

      assert %LiveSessionModerationAction{
               action_type: :message_removed,
               live_session_id: live_session_id,
               actor_user_id: actor_user_id,
               target_user_id: target_user_id,
               target_event_id: target_event_id,
               reason_code: "abuse",
               internal_note: "reported by viewers"
             } = Repo.get!(LiveSessionModerationAction, moderation_action_id)

      assert live_session_id == session.id
      assert actor_user_id == host.id
      assert target_user_id == sender.id
      assert target_event_id == first.id

      assert %LiveSessionTimelineEvent{
               live_session_id: removal_live_session_id,
               actor_user_id: removal_actor_user_id,
               event_type: :chat_message_removed,
               target_event_id: ^removed_id,
               payload: %{}
             } = Repo.get!(LiveSessionTimelineEvent, removal_event_id)

      assert removal_live_session_id == session.id
      assert removal_actor_user_id == host.id

      assert %LiveSessionTimelineModerationEvent{
               live_session_id: moderation_event_live_session_id,
               moderation_action_id: ^moderation_action_id
             } = Repo.get!(LiveSessionTimelineModerationEvent, removal_event_id)

      assert moderation_event_live_session_id == session.id

      assert %LiveSessionTimelineEventState{projection_state: :internal} =
               Repo.get!(LiveSessionTimelineEventState, removal_event_id)
    end

    test "does not create another removal event for repeated removals" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "remove once"})

      assert {:ok, %{transitioned?: true}} =
               Chat.remove_timeline_chat_message(event, host, %{})

      assert {:ok, %{removed_event_id: removed_id, transitioned?: false}} =
               Chat.remove_timeline_chat_message(event, host, %{})

      assert removed_id == event.id

      assert 1 ==
               from(timeline_event in LiveSessionTimelineEvent,
                 where:
                   timeline_event.live_session_id == ^session.id and
                     timeline_event.event_type == :chat_message_removed
               )
               |> Repo.aggregate(:count)
    end

    test "denies removal by non-hosts" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "keep"})

      assert {:error, :not_authorized} =
               Chat.remove_timeline_chat_message(event, sender, %{})
    end

    test "returns changeset errors for invalid removal metadata" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "remove"})

      assert {:error, %Ecto.Changeset{} = changeset} =
               Chat.remove_timeline_chat_message(event, host, %{reason_code: 123})

      assert :reason_code in Keyword.keys(changeset.errors)
    end
  end
end
