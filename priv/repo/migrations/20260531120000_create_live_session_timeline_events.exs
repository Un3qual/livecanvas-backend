defmodule LiveCanvas.Repo.Migrations.CreateLiveSessionTimelineEvents do
  use Ecto.Migration

  def change do
    create table(:live_session_timeline_events) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :event_type, :text, null: false
      add :actor_user_id, references(:users, on_delete: :nilify_all)
      add :target_event_id, references(:live_session_timeline_events, on_delete: :nothing)
      add :occurred_at, :utc_datetime_usec, null: false
      add :idempotency_key, :text
      add :payload, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:live_session_timeline_events, [:entropy_id])
    create unique_index(:live_session_timeline_events, [:id, :live_session_id])
    create index(:live_session_timeline_events, [:live_session_id])
    create index(:live_session_timeline_events, [:actor_user_id])
    create index(:live_session_timeline_events, [:target_event_id])
    create index(:live_session_timeline_events, [:live_session_id, :occurred_at, :id])

    create unique_index(
             :live_session_timeline_events,
             [:live_session_id, :event_type, :idempotency_key],
             name: :live_session_timeline_events_idempotency_key_index,
             where: "idempotency_key is not null"
           )

    create constraint(
             :live_session_timeline_events,
             :live_session_timeline_events_event_type_check,
             check:
               "event_type in ('chat_message_sent', 'chat_message_edited', 'chat_message_removed', 'live_session_started', 'live_session_ended')"
           )

    execute(
      """
      alter table live_session_timeline_events
      add constraint live_session_timeline_events_target_same_session_fk
      foreign key (target_event_id, live_session_id)
      references live_session_timeline_events(id, live_session_id)
      """,
      """
      alter table live_session_timeline_events
      drop constraint live_session_timeline_events_target_same_session_fk
      """
    )

    create table(:live_session_moderation_actions) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :action_type, :text, null: false
      add :actor_user_id, references(:users, on_delete: :restrict), null: false
      add :target_user_id, references(:users, on_delete: :nilify_all)
      add :target_event_id, references(:live_session_timeline_events, on_delete: :nilify_all)
      add :reason_code, :text
      add :internal_note, :text
      add :expires_at, :utc_datetime_usec
      add :revoked_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:live_session_moderation_actions, [:entropy_id])

    execute(
      """
      create unique index live_session_moderation_actions_id_live_session_id_index
      on live_session_moderation_actions (id, live_session_id)
      """,
      """
      drop index if exists live_session_moderation_actions_id_live_session_id_index
      """
    )

    create index(:live_session_moderation_actions, [:live_session_id])
    create index(:live_session_moderation_actions, [:actor_user_id])
    create index(:live_session_moderation_actions, [:target_user_id])
    create index(:live_session_moderation_actions, [:target_event_id])

    create index(
             :live_session_moderation_actions,
             [:live_session_id, :target_user_id, :action_type],
             name: :live_session_moderation_actions_active_index,
             where: "revoked_at is null"
           )

    create unique_index(
             :live_session_moderation_actions,
             [:target_event_id, :action_type],
             name: :live_session_moderation_actions_message_removed_target_index,
             where: "revoked_at is null and action_type = 'message_removed'"
           )

    create constraint(
             :live_session_moderation_actions,
             :live_session_moderation_actions_action_type_check,
             check: "action_type in ('message_removed', 'user_muted', 'user_banned')"
           )

    execute(
      """
      alter table live_session_moderation_actions
      add constraint live_session_moderation_actions_target_same_session_fk
      foreign key (target_event_id, live_session_id)
      references live_session_timeline_events(id, live_session_id)
      on delete set null (target_event_id)
      """,
      """
      alter table live_session_moderation_actions
      drop constraint if exists live_session_moderation_actions_target_same_session_fk
      """
    )

    create table(:live_session_timeline_event_states, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :occurred_at, :utc_datetime_usec, null: false
      add :projection_state, :text, null: false

      add :superseded_by_event_id,
          references(:live_session_timeline_events, on_delete: :nilify_all)

      add :moderation_action_id,
          references(:live_session_moderation_actions, on_delete: :nilify_all)

      add :updated_at, :utc_datetime_usec, null: false
    end

    create index(
             :live_session_timeline_event_states,
             [:live_session_id, :occurred_at, :timeline_event_id],
             name: :live_session_timeline_event_states_current_history_index,
             where: "projection_state in ('visible', 'redacted_placeholder')"
           )

    create index(:live_session_timeline_event_states, [:superseded_by_event_id])
    create index(:live_session_timeline_event_states, [:moderation_action_id])

    create constraint(
             :live_session_timeline_event_states,
             :live_session_timeline_event_states_projection_state_check,
             check:
               "projection_state in ('visible', 'hidden', 'redacted_placeholder', 'internal')"
           )

    execute(
      """
      alter table live_session_timeline_event_states
      add constraint live_session_timeline_event_states_event_same_session_fk
      foreign key (timeline_event_id, live_session_id)
      references live_session_timeline_events(id, live_session_id)
      on delete cascade
      """,
      """
      alter table live_session_timeline_event_states
      drop constraint if exists live_session_timeline_event_states_event_same_session_fk
      """
    )

    execute(
      """
      alter table live_session_timeline_event_states
      add constraint live_session_timeline_event_states_superseded_same_session_fk
      foreign key (superseded_by_event_id, live_session_id)
      references live_session_timeline_events(id, live_session_id)
      on delete set null (superseded_by_event_id)
      """,
      """
      alter table live_session_timeline_event_states
      drop constraint if exists live_session_timeline_event_states_superseded_same_session_fk
      """
    )

    execute(
      """
      alter table live_session_timeline_event_states
      add constraint timeline_event_states_moderation_action_same_session_fk
      foreign key (moderation_action_id, live_session_id)
      references live_session_moderation_actions(id, live_session_id)
      on delete set null (moderation_action_id)
      """,
      """
      alter table live_session_timeline_event_states
      drop constraint if exists timeline_event_states_moderation_action_same_session_fk
      """
    )

    create table(:live_session_timeline_chat_messages, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :body, :text, null: false
      add :body_format, :text, null: false, default: "plain"
    end

    create constraint(
             :live_session_timeline_chat_messages,
             :live_session_timeline_chat_messages_body_format_check,
             check: "body_format in ('plain')"
           )

    create table(:live_session_timeline_chat_message_states, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :current_body, :text
      add :edit_count, :bigint, null: false, default: 0

      add :last_edit_event_id,
          references(:live_session_timeline_events, on_delete: :nilify_all)

      add :last_edited_at, :utc_datetime_usec
      add :updated_at, :utc_datetime_usec, null: false
    end

    create index(:live_session_timeline_chat_message_states, [:last_edit_event_id])

    create constraint(
             :live_session_timeline_chat_message_states,
             :live_session_timeline_chat_message_states_edit_count_check,
             check: "edit_count >= 0"
           )

    create table(:live_session_timeline_chat_message_edits, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :target_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          null: false

      add :previous_body, :text, null: false
      add :new_body, :text, null: false
    end

    create index(
             :live_session_timeline_chat_message_edits,
             [:target_event_id, :timeline_event_id],
             name: :live_session_timeline_chat_message_edits_target_index
           )

    create table(:live_session_timeline_moderation_events, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :moderation_action_id,
          references(:live_session_moderation_actions, on_delete: :delete_all),
          null: false
    end

    create unique_index(
             :live_session_timeline_moderation_events,
             [:moderation_action_id],
             name: :live_session_timeline_moderation_events_action_id_index
           )
  end
end
