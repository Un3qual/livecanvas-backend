defmodule LCSchemas.Chat.TimelineEventSchemaTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Live

  alias LCSchemas.Chat.{
    LiveSessionModerationAction,
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageEdit,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState,
    LiveSessionTimelineModerationEvent
  }

  test "timeline schemas use utc microsecond timestamps and relational ids" do
    assert LiveSessionTimelineEvent.__schema__(:type, :occurred_at) == :utc_datetime_usec
    assert LiveSessionTimelineEvent.__schema__(:type, :inserted_at) == :utc_datetime_usec
    assert LiveSessionTimelineEvent.__schema__(:type, :updated_at) == :utc_datetime_usec
    assert LiveSessionTimelineEvent.__schema__(:type, :id) == :id
    assert LiveSessionTimelineEvent.__schema__(:type, :entropy_id) == Ecto.UUID

    assert LiveSessionTimelineEventState.__schema__(:type, :updated_at) == :utc_datetime_usec

    assert LiveSessionTimelineChatMessageState.__schema__(:type, :last_edited_at) ==
             :utc_datetime_usec

    assert LiveSessionModerationAction.__schema__(:type, :expires_at) == :utc_datetime_usec
  end

  test "chat message send, edit, and moderation rows persist with expected associations" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    event =
      Repo.insert!(%LiveSessionTimelineEvent{
        live_session_id: session.id,
        actor_user_id: viewer.id,
        event_type: :chat_message_sent,
        occurred_at: now,
        payload: %{}
      })

    Repo.insert!(%LiveSessionTimelineChatMessage{
      timeline_event_id: event.id,
      body: "hello",
      body_format: :plain
    })

    Repo.insert!(%LiveSessionTimelineChatMessageState{
      timeline_event_id: event.id,
      live_session_id: session.id,
      current_body: "hello",
      edit_count: 0,
      updated_at: now
    })

    Repo.insert!(%LiveSessionTimelineEventState{
      timeline_event_id: event.id,
      live_session_id: session.id,
      occurred_at: now,
      projection_state: :visible,
      updated_at: now
    })

    edit_event =
      Repo.insert!(%LiveSessionTimelineEvent{
        live_session_id: session.id,
        actor_user_id: viewer.id,
        target_event_id: event.id,
        event_type: :chat_message_edited,
        occurred_at: DateTime.add(now, 1, :second),
        payload: %{}
      })

    Repo.insert!(%LiveSessionTimelineChatMessageEdit{
      timeline_event_id: edit_event.id,
      live_session_id: session.id,
      target_event_id: event.id,
      previous_body: "hello",
      new_body: "hello!"
    })

    moderation_action =
      Repo.insert!(%LiveSessionModerationAction{
        live_session_id: session.id,
        action_type: :message_removed,
        actor_user_id: host.id,
        target_user_id: viewer.id,
        target_event_id: event.id
      })

    moderation_event =
      Repo.insert!(%LiveSessionTimelineEvent{
        live_session_id: session.id,
        actor_user_id: host.id,
        target_event_id: event.id,
        event_type: :chat_message_removed,
        occurred_at: DateTime.add(now, 2, :second),
        payload: %{}
      })

    Repo.insert!(%LiveSessionTimelineModerationEvent{
      timeline_event_id: moderation_event.id,
      live_session_id: session.id,
      moderation_action_id: moderation_action.id
    })

    assert Repo.get!(LiveSessionTimelineChatMessage, event.id).body == "hello"
    assert Repo.get!(LiveSessionTimelineChatMessageEdit, edit_event.id).new_body == "hello!"

    assert Repo.get!(LiveSessionTimelineModerationEvent, moderation_event.id).moderation_action_id ==
             moderation_action.id
  end

  test "moderation actions cannot target timeline events from another live session" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{host: other_host, session: other_session} = live_session_fixture()
    target_event = insert_timeline_event!(source_session, source_host)

    assert %LiveSessionModerationAction{target_event_id: nil} =
             Repo.insert!(%LiveSessionModerationAction{
               live_session_id: other_session.id,
               action_type: :user_muted,
               actor_user_id: other_host.id,
               target_user_id: source_host.id
             })

    assert_raise Ecto.ConstraintError,
                 ~r/live_session_moderation_actions_target_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionModerationAction{
                     live_session_id: other_session.id,
                     action_type: :message_removed,
                     actor_user_id: other_host.id,
                     target_user_id: source_host.id,
                     target_event_id: target_event.id
                   })
                 end
  end

  test "event states cannot denormalize a different live session than their timeline event" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{session: other_session} = live_session_fixture()
    timeline_event = insert_timeline_event!(source_session, source_host)

    assert_raise Ecto.ConstraintError,
                 ~r/live_session_timeline_event_states_event_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionTimelineEventState{
                     timeline_event_id: timeline_event.id,
                     live_session_id: other_session.id,
                     occurred_at: timeline_event.occurred_at,
                     projection_state: :visible,
                     updated_at: now_utc()
                   })
                 end
  end

  test "event states cannot point superseded events at another live session" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{host: other_host, session: other_session} = live_session_fixture()
    timeline_event = insert_timeline_event!(source_session, source_host)
    superseding_event = insert_timeline_event!(other_session, other_host)

    assert_raise Ecto.ConstraintError,
                 ~r/live_session_timeline_event_states_superseded_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionTimelineEventState{
                     timeline_event_id: timeline_event.id,
                     live_session_id: source_session.id,
                     occurred_at: timeline_event.occurred_at,
                     projection_state: :hidden,
                     superseded_by_event_id: superseding_event.id,
                     updated_at: now_utc()
                   })
                 end
  end

  test "event states cannot point moderation actions at another live session" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{host: other_host, session: other_session} = live_session_fixture()
    timeline_event = insert_timeline_event!(source_session, source_host)

    moderation_action =
      Repo.insert!(%LiveSessionModerationAction{
        live_session_id: other_session.id,
        action_type: :user_muted,
        actor_user_id: other_host.id,
        target_user_id: source_host.id
      })

    assert_raise Ecto.ConstraintError,
                 ~r/timeline_event_states_moderation_action_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionTimelineEventState{
                     timeline_event_id: timeline_event.id,
                     live_session_id: source_session.id,
                     occurred_at: timeline_event.occurred_at,
                     projection_state: :hidden,
                     moderation_action_id: moderation_action.id,
                     updated_at: now_utc()
                   })
                 end
  end

  test "chat message states cannot point last edit events at another live session" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{host: other_host, session: other_session} = live_session_fixture()
    timeline_event = insert_timeline_event!(source_session, source_host)

    last_edit_event =
      insert_timeline_event!(other_session, other_host, %{event_type: :chat_message_edited})

    assert_raise Ecto.ConstraintError,
                 ~r/chat_message_states_last_edit_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionTimelineChatMessageState{
                     timeline_event_id: timeline_event.id,
                     live_session_id: source_session.id,
                     current_body: "hello",
                     edit_count: 1,
                     last_edit_event_id: last_edit_event.id,
                     last_edited_at: last_edit_event.occurred_at,
                     updated_at: now_utc()
                   })
                 end
  end

  test "chat message edit rows cannot target events from another live session" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{host: other_host, session: other_session} = live_session_fixture()

    edit_event =
      insert_timeline_event!(source_session, source_host, %{event_type: :chat_message_edited})

    target_event = insert_timeline_event!(other_session, other_host)

    assert_raise Ecto.ConstraintError,
                 ~r/chat_message_edits_target_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionTimelineChatMessageEdit{
                     timeline_event_id: edit_event.id,
                     live_session_id: source_session.id,
                     target_event_id: target_event.id,
                     previous_body: "hello",
                     new_body: "hello!"
                   })
                 end
  end

  test "timeline moderation events cannot use actions from another live session" do
    %{host: source_host, session: source_session} = live_session_fixture()
    %{host: other_host, session: other_session} = live_session_fixture()

    moderation_event =
      insert_timeline_event!(source_session, source_host, %{event_type: :chat_message_removed})

    moderation_action =
      Repo.insert!(%LiveSessionModerationAction{
        live_session_id: other_session.id,
        action_type: :user_muted,
        actor_user_id: other_host.id,
        target_user_id: source_host.id
      })

    assert_raise Ecto.ConstraintError,
                 ~r/timeline_moderation_events_action_same_session_fk/,
                 fn ->
                   Repo.insert!(%LiveSessionTimelineModerationEvent{
                     timeline_event_id: moderation_event.id,
                     live_session_id: source_session.id,
                     moderation_action_id: moderation_action.id
                   })
                 end
  end

  defp live_session_fixture do
    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    %{host: host, session: session}
  end

  defp insert_timeline_event!(live_session, actor, attrs \\ %{}) do
    attrs =
      Map.merge(
        %{
          live_session_id: live_session.id,
          actor_user_id: actor.id,
          event_type: :chat_message_sent,
          occurred_at: now_utc(),
          payload: %{}
        },
        attrs
      )

    Repo.insert!(struct(LiveSessionTimelineEvent, attrs))
  end

  defp now_utc do
    DateTime.utc_now() |> DateTime.truncate(:microsecond)
  end
end
