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
      moderation_action_id: moderation_action.id
    })

    assert Repo.get!(LiveSessionTimelineChatMessage, event.id).body == "hello"
    assert Repo.get!(LiveSessionTimelineChatMessageEdit, edit_event.id).new_body == "hello!"

    assert Repo.get!(LiveSessionTimelineModerationEvent, moderation_event.id).moderation_action_id ==
             moderation_action.id
  end
end
