defmodule LC.Chat.TimelineEventChanges do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Chat.{
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageEdit,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState
  }

  @max_body_length 2000

  @type attrs :: %{optional(atom() | String.t()) => term()}

  @spec attrs_for_chat_message_insert(pos_integer(), pos_integer(), attrs(), DateTime.t()) :: %{
          event: map(),
          chat_message: map(),
          chat_message_state: map(),
          event_state: map()
        }
  def attrs_for_chat_message_insert(live_session_id, actor_user_id, attrs, %DateTime{} = now)
      when is_integer(live_session_id) and is_integer(actor_user_id) and is_map(attrs) do
    body = attrs |> value_for(:body, "") |> normalize_body()

    %{
      event: %{
        live_session_id: live_session_id,
        actor_user_id: actor_user_id,
        event_type: :chat_message_sent,
        occurred_at: now,
        payload: %{}
      },
      chat_message: %{
        body: body,
        body_format: :plain
      },
      chat_message_state: %{
        live_session_id: live_session_id,
        current_body: body,
        edit_count: 0,
        updated_at: now
      },
      event_state: %{
        live_session_id: live_session_id,
        occurred_at: now,
        projection_state: :visible,
        updated_at: now
      }
    }
  end

  @spec attrs_for_chat_message_edit_insert(
          pos_integer(),
          pos_integer(),
          pos_integer(),
          String.t(),
          attrs(),
          DateTime.t()
        ) :: %{
          event: map(),
          chat_message_edit: map()
        }
  def attrs_for_chat_message_edit_insert(
        live_session_id,
        actor_user_id,
        target_event_id,
        previous_body,
        attrs,
        %DateTime{} = now
      )
      when is_integer(live_session_id) and is_integer(actor_user_id) and
             is_integer(target_event_id) and is_binary(previous_body) and is_map(attrs) do
    new_body = attrs |> value_for(:body, "") |> normalize_body()

    %{
      event: %{
        live_session_id: live_session_id,
        actor_user_id: actor_user_id,
        target_event_id: target_event_id,
        event_type: :chat_message_edited,
        occurred_at: now,
        payload: %{}
      },
      chat_message_edit: %{
        live_session_id: live_session_id,
        target_event_id: target_event_id,
        previous_body: previous_body,
        new_body: new_body
      }
    }
  end

  @spec chat_message_event_changeset(LiveSessionTimelineEvent.t(), attrs()) ::
          Ecto.Changeset.t()
  def chat_message_event_changeset(%LiveSessionTimelineEvent{} = timeline_event, attrs)
      when is_map(attrs) do
    timeline_event
    |> cast(attrs, [
      :live_session_id,
      :event_type,
      :actor_user_id,
      :target_event_id,
      :occurred_at,
      :idempotency_key,
      :payload
    ])
    |> validate_required([:live_session_id, :event_type, :actor_user_id, :occurred_at, :payload])
    |> validate_number(:live_session_id, greater_than: 0)
    |> validate_number(:actor_user_id, greater_than: 0)
    |> validate_number(:target_event_id, greater_than: 0)
    |> validate_change(:payload, &validate_map/2)
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:actor_user_id)
    |> foreign_key_constraint(:target_event_id)
    |> check_constraint(:event_type, name: :live_session_timeline_events_event_type_check)
    |> unique_constraint(:idempotency_key,
      name: :live_session_timeline_events_idempotency_key_index
    )
  end

  @spec chat_message_changeset(LiveSessionTimelineChatMessage.t(), attrs()) ::
          Ecto.Changeset.t()
  def chat_message_changeset(%LiveSessionTimelineChatMessage{} = chat_message, attrs)
      when is_map(attrs) do
    chat_message
    |> cast(attrs, [:timeline_event_id, :body, :body_format])
    |> validate_required([:timeline_event_id, :body, :body_format])
    |> validate_number(:timeline_event_id, greater_than: 0)
    |> validate_length(:body, min: 1, max: @max_body_length)
    |> foreign_key_constraint(:timeline_event_id)
    |> check_constraint(:body_format,
      name: :live_session_timeline_chat_messages_body_format_check
    )
  end

  @spec chat_message_edit_changeset(LiveSessionTimelineChatMessageEdit.t(), attrs()) ::
          Ecto.Changeset.t()
  def chat_message_edit_changeset(
        %LiveSessionTimelineChatMessageEdit{} = chat_message_edit,
        attrs
      )
      when is_map(attrs) do
    chat_message_edit
    |> cast(attrs, [
      :timeline_event_id,
      :live_session_id,
      :target_event_id,
      :previous_body,
      :new_body
    ])
    |> validate_required([
      :timeline_event_id,
      :live_session_id,
      :target_event_id,
      :previous_body,
      :new_body
    ])
    |> validate_number(:timeline_event_id, greater_than: 0)
    |> validate_number(:live_session_id, greater_than: 0)
    |> validate_number(:target_event_id, greater_than: 0)
    |> validate_length(:previous_body, min: 1, max: @max_body_length)
    |> validate_length(:new_body, min: 1, max: @max_body_length)
    |> foreign_key_constraint(:timeline_event_id)
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:target_event_id)
  end

  @spec chat_message_state_changeset(LiveSessionTimelineChatMessageState.t(), attrs()) ::
          Ecto.Changeset.t()
  def chat_message_state_changeset(
        %LiveSessionTimelineChatMessageState{} = chat_message_state,
        attrs
      )
      when is_map(attrs) do
    chat_message_state
    |> cast(attrs, [
      :timeline_event_id,
      :live_session_id,
      :current_body,
      :edit_count,
      :last_edit_event_id,
      :last_edited_at,
      :updated_at
    ])
    |> validate_required([
      :timeline_event_id,
      :live_session_id,
      :current_body,
      :edit_count,
      :updated_at
    ])
    |> validate_number(:timeline_event_id, greater_than: 0)
    |> validate_number(:live_session_id, greater_than: 0)
    |> validate_number(:edit_count, greater_than_or_equal_to: 0)
    |> validate_number(:last_edit_event_id, greater_than: 0)
    |> validate_length(:current_body, min: 1, max: @max_body_length)
    |> foreign_key_constraint(:timeline_event_id)
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:last_edit_event_id)
    |> check_constraint(:edit_count,
      name: :live_session_timeline_chat_message_states_edit_count_check
    )
  end

  @spec event_state_changeset(LiveSessionTimelineEventState.t(), attrs()) :: Ecto.Changeset.t()
  def event_state_changeset(%LiveSessionTimelineEventState{} = event_state, attrs)
      when is_map(attrs) do
    event_state
    |> cast(attrs, [
      :timeline_event_id,
      :live_session_id,
      :occurred_at,
      :projection_state,
      :superseded_by_event_id,
      :moderation_action_id,
      :updated_at
    ])
    |> validate_required([
      :timeline_event_id,
      :live_session_id,
      :occurred_at,
      :projection_state,
      :updated_at
    ])
    |> validate_number(:timeline_event_id, greater_than: 0)
    |> validate_number(:live_session_id, greater_than: 0)
    |> validate_number(:superseded_by_event_id, greater_than: 0)
    |> validate_number(:moderation_action_id, greater_than: 0)
    |> foreign_key_constraint(:timeline_event_id)
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:superseded_by_event_id)
    |> foreign_key_constraint(:moderation_action_id)
    |> check_constraint(:projection_state,
      name: :live_session_timeline_event_states_projection_state_check
    )
  end

  defp value_for(attrs, key, default) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key)) || default
  end

  defp normalize_body(body) when is_binary(body), do: String.trim(body)
  defp normalize_body(body), do: body

  defp validate_map(field, value) do
    if is_map(value), do: [], else: [{field, "must be a map"}]
  end
end
