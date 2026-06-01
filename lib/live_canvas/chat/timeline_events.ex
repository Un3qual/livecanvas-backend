defmodule LC.Chat.TimelineEvents do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.Chat.{TimelineEventChanges, TimelineProjection}

  alias LCSchemas.Accounts.User

  alias LCSchemas.Chat.{
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState
  }

  alias LCSchemas.Live.LiveSession

  @visible_projection_states [:visible, :redacted_placeholder]

  @type repo :: module()
  @type create_result :: {:ok, TimelineProjection.t()} | {:error, Ecto.Changeset.t()}

  @spec create_chat_message(repo(), LiveSession.t(), User.t(), map()) :: create_result()
  def create_chat_message(
        repo,
        %LiveSession{id: live_session_id},
        %User{id: actor_user_id},
        attrs
      )
      when is_atom(repo) and is_integer(live_session_id) and is_integer(actor_user_id) and
             is_map(attrs) do
    now = now_utc()

    %{
      event: event_attrs,
      chat_message: chat_message_attrs,
      chat_message_state: chat_message_state_attrs,
      event_state: event_state_attrs
    } =
      TimelineEventChanges.attrs_for_chat_message_insert(
        live_session_id,
        actor_user_id,
        attrs,
        now
      )

    repo.transaction(fn ->
      with {:ok, event} <- insert_timeline_event(repo, event_attrs),
           {:ok, _chat_message} <-
             insert_chat_message(repo, Map.put(chat_message_attrs, :timeline_event_id, event.id)),
           {:ok, _chat_message_state} <-
             insert_chat_message_state(
               repo,
               Map.put(chat_message_state_attrs, :timeline_event_id, event.id)
             ),
           {:ok, _event_state} <-
             insert_event_state(repo, Map.put(event_state_attrs, :timeline_event_id, event.id)) do
        event.id
        |> event_query()
        |> repo.one()
      else
        {:error, %Ecto.Changeset{} = changeset} -> repo.rollback(changeset)
      end
    end)
  end

  @spec history_query(pos_integer()) :: Ecto.Query.t()
  def history_query(live_session_id) when is_integer(live_session_id) do
    base_projection_query()
    |> where([event_state: event_state], event_state.live_session_id == ^live_session_id)
    |> order_by([event_state: event_state],
      asc: event_state.occurred_at,
      asc: event_state.timeline_event_id
    )
  end

  @spec event_query(pos_integer()) :: Ecto.Query.t()
  def event_query(timeline_event_id) when is_integer(timeline_event_id) do
    base_projection_query()
    |> where([event_state: event_state], event_state.timeline_event_id == ^timeline_event_id)
    |> limit(1)
  end

  @spec now_utc() :: DateTime.t()
  defp now_utc do
    DateTime.utc_now() |> DateTime.truncate(:microsecond)
  end

  @spec insert_timeline_event(repo(), map()) ::
          {:ok, LiveSessionTimelineEvent.t()} | {:error, Ecto.Changeset.t()}
  defp insert_timeline_event(repo, attrs) do
    %LiveSessionTimelineEvent{}
    |> TimelineEventChanges.chat_message_event_changeset(attrs)
    |> repo.insert()
  end

  @spec insert_chat_message(repo(), map()) ::
          {:ok, LiveSessionTimelineChatMessage.t()} | {:error, Ecto.Changeset.t()}
  defp insert_chat_message(repo, attrs) do
    %LiveSessionTimelineChatMessage{}
    |> TimelineEventChanges.chat_message_changeset(attrs)
    |> repo.insert()
  end

  @spec insert_chat_message_state(repo(), map()) ::
          {:ok, LiveSessionTimelineChatMessageState.t()} | {:error, Ecto.Changeset.t()}
  defp insert_chat_message_state(repo, attrs) do
    %LiveSessionTimelineChatMessageState{}
    |> TimelineEventChanges.chat_message_state_changeset(attrs)
    |> repo.insert()
  end

  @spec insert_event_state(repo(), map()) ::
          {:ok, LiveSessionTimelineEventState.t()} | {:error, Ecto.Changeset.t()}
  defp insert_event_state(repo, attrs) do
    %LiveSessionTimelineEventState{}
    |> TimelineEventChanges.event_state_changeset(attrs)
    |> repo.insert()
  end

  @spec base_projection_query() :: Ecto.Query.t()
  defp base_projection_query do
    from(event_state in LiveSessionTimelineEventState,
      as: :event_state,
      join: event in assoc(event_state, :timeline_event),
      as: :event,
      join: chat_message_state in LiveSessionTimelineChatMessageState,
      as: :chat_message_state,
      on: chat_message_state.timeline_event_id == event_state.timeline_event_id,
      left_join: actor in assoc(event, :actor),
      as: :actor,
      where: event_state.projection_state in ^@visible_projection_states,
      select: %{
        id: event.id,
        entropy_id: event.entropy_id,
        live_session_id: event.live_session_id,
        event_type: event.event_type,
        actor_user_id: event.actor_user_id,
        actor: actor,
        occurred_at: event_state.occurred_at,
        target_event_id: event.target_event_id,
        projection_state: event_state.projection_state,
        body: chat_message_state.current_body,
        edited: chat_message_state.edit_count > 0,
        edit_count: chat_message_state.edit_count,
        edited_at: chat_message_state.last_edited_at
      }
    )
  end
end
