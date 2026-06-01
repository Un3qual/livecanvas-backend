defmodule LC.Chat.TimelineEvents do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.Chat.{TimelineEventChanges, TimelineProjection}

  alias LCSchemas.Accounts.User

  alias LCSchemas.Chat.{
    LiveSessionModerationAction,
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageEdit,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState,
    LiveSessionTimelineModerationEvent
  }

  alias LCSchemas.Live.LiveSession

  @visible_projection_states [:visible, :redacted_placeholder]

  @type repo :: module()
  @type create_result :: {:ok, TimelineProjection.t()} | {:error, Ecto.Changeset.t()}
  @type edit_authorizer ::
          (User.t(), LiveSession.t() -> :ok | {:error, :not_authorized | :session_ended})
  @type edit_result ::
          {:ok, TimelineProjection.t()}
          | {:error, Ecto.Changeset.t() | :not_authorized | :not_found | :hidden | :session_ended}
  @type lifecycle_event_type :: :live_session_started | :live_session_ended
  @type lifecycle_result :: {:ok, TimelineProjection.t()} | {:error, Ecto.Changeset.t()}
  @type removal_authorizer :: (LiveSession.t(), User.t() -> :ok | {:error, :not_authorized})
  @type removal_result ::
          {:ok, %{removed_event_id: pos_integer(), transitioned?: boolean()}}
          | {:error, Ecto.Changeset.t() | :not_authorized | :not_found | :not_chat_message}

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

  @spec edit_chat_message(
          repo(),
          TimelineProjection.t() | map(),
          User.t(),
          map(),
          edit_authorizer()
        ) ::
          edit_result()
  def edit_chat_message(repo, timeline_event, %User{id: actor_user_id} = actor, attrs, authorizer)
      when is_atom(repo) and is_map(timeline_event) and is_integer(actor_user_id) and
             is_map(attrs) and is_function(authorizer, 2) do
    with {:ok, target_event_id} <- target_event_id_from(timeline_event) do
      repo.transaction(fn ->
        with %LiveSessionTimelineEvent{} = target_event <-
               target_event_query(target_event_id) |> repo.one(),
             :ok <- require_editable_event_type(target_event),
             :ok <- require_original_actor(target_event, actor_user_id),
             %LiveSession{} = live_session <- repo.get(LiveSession, target_event.live_session_id),
             :ok <- authorizer.(actor, live_session),
             %LiveSessionTimelineEventState{} = event_state <-
               locked_event_state_query(target_event_id) |> repo.one(),
             :ok <- require_visible_projection(event_state),
             %LiveSessionTimelineChatMessageState{} = chat_message_state <-
               locked_chat_message_state_query(target_event_id) |> repo.one(),
             edit_change_attrs =
               chat_message_edit_change_attrs(
                 target_event,
                 actor_user_id,
                 chat_message_state,
                 attrs
               ),
             {:ok, edit_event} <-
               insert_timeline_event(repo, edit_change_attrs.event),
             {:ok, _chat_message_edit} <-
               insert_chat_message_edit(
                 repo,
                 Map.put(edit_change_attrs.chat_message_edit, :timeline_event_id, edit_event.id)
               ),
             {:ok, _chat_message_state} <-
               update_chat_message_state(
                 repo,
                 chat_message_state,
                 chat_message_state_edit_attrs(
                   chat_message_state,
                   edit_event,
                   edit_change_attrs.chat_message_edit
                 )
               ) do
          projection_for_event!(repo, target_event.id)
        else
          nil -> repo.rollback(:not_found)
          {:error, %Ecto.Changeset{} = changeset} -> repo.rollback(changeset)
          {:error, reason} -> repo.rollback(reason)
        end
      end)
    end
  end

  @spec remove_chat_message(
          repo(),
          TimelineProjection.t() | map(),
          User.t(),
          map(),
          removal_authorizer()
        ) ::
          removal_result()
  def remove_chat_message(
        repo,
        timeline_event,
        %User{id: actor_user_id} = actor,
        attrs,
        authorizer
      )
      when is_atom(repo) and is_map(timeline_event) and is_integer(actor_user_id) and
             is_map(attrs) and is_function(authorizer, 2) do
    with {:ok, target_event_id} <- target_event_id_from(timeline_event) do
      repo.transaction(fn ->
        with %LiveSessionTimelineEventState{} = event_state <-
               locked_event_state_query(target_event_id) |> repo.one(),
             %LiveSessionTimelineEvent{} = target_event <-
               target_event_query(target_event_id) |> repo.one(),
             :ok <- require_removable_event_type(target_event),
             %LiveSession{} = live_session <- repo.get(LiveSession, target_event.live_session_id),
             :ok <- authorizer.(live_session, actor) do
          remove_chat_message_projection(repo, target_event, event_state, actor_user_id, attrs)
        else
          nil -> repo.rollback(:not_found)
          {:error, %Ecto.Changeset{} = changeset} -> repo.rollback(changeset)
          {:error, reason} -> repo.rollback(reason)
        end
      end)
    end
  end

  @spec record_lifecycle_event(repo(), LiveSession.t(), User.t(), lifecycle_event_type()) ::
          lifecycle_result()
  def record_lifecycle_event(
        repo,
        %LiveSession{id: live_session_id},
        %User{id: actor_user_id},
        event_type
      )
      when is_atom(repo) and is_integer(live_session_id) and is_integer(actor_user_id) and
             event_type in [:live_session_started, :live_session_ended] do
    %{event: event_attrs, event_state: event_state_attrs} =
      TimelineEventChanges.attrs_for_lifecycle_event_insert(
        live_session_id,
        actor_user_id,
        event_type,
        now_utc()
      )

    repo.transaction(fn ->
      with {:ok, event} <- insert_timeline_event(repo, event_attrs),
           {:ok, _event_state} <-
             insert_event_state(repo, Map.put(event_state_attrs, :timeline_event_id, event.id)) do
        projection_for_event!(repo, event.id)
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

  @spec target_event_id_from(TimelineProjection.t() | map()) ::
          {:ok, pos_integer()} | {:error, :not_found}
  defp target_event_id_from(%{id: timeline_event_id})
       when is_integer(timeline_event_id) and timeline_event_id > 0 do
    {:ok, timeline_event_id}
  end

  defp target_event_id_from(%{"id" => timeline_event_id})
       when is_integer(timeline_event_id) and timeline_event_id > 0 do
    {:ok, timeline_event_id}
  end

  defp target_event_id_from(_timeline_event), do: {:error, :not_found}

  @spec require_editable_event_type(LiveSessionTimelineEvent.t()) :: :ok | {:error, :not_found}
  defp require_editable_event_type(%LiveSessionTimelineEvent{event_type: :chat_message_sent}),
    do: :ok

  defp require_editable_event_type(%LiveSessionTimelineEvent{}), do: {:error, :not_found}

  @spec require_removable_event_type(LiveSessionTimelineEvent.t()) ::
          :ok | {:error, :not_chat_message}
  defp require_removable_event_type(%LiveSessionTimelineEvent{event_type: :chat_message_sent}),
    do: :ok

  defp require_removable_event_type(%LiveSessionTimelineEvent{}),
    do: {:error, :not_chat_message}

  @spec require_original_actor(LiveSessionTimelineEvent.t(), pos_integer()) ::
          :ok | {:error, :not_authorized}
  defp require_original_actor(
         %LiveSessionTimelineEvent{actor_user_id: actor_user_id},
         actor_user_id
       )
       when is_integer(actor_user_id),
       do: :ok

  defp require_original_actor(%LiveSessionTimelineEvent{}, _actor_user_id),
    do: {:error, :not_authorized}

  @spec require_visible_projection(LiveSessionTimelineEventState.t()) ::
          :ok | {:error, :hidden}
  defp require_visible_projection(%LiveSessionTimelineEventState{projection_state: :visible}),
    do: :ok

  defp require_visible_projection(%LiveSessionTimelineEventState{}), do: {:error, :hidden}

  @spec target_event_query(pos_integer()) :: Ecto.Query.t()
  defp target_event_query(timeline_event_id) when is_integer(timeline_event_id) do
    from(event in LiveSessionTimelineEvent,
      where: event.id == ^timeline_event_id,
      limit: 1
    )
  end

  @spec locked_event_state_query(pos_integer()) :: Ecto.Query.t()
  defp locked_event_state_query(timeline_event_id) when is_integer(timeline_event_id) do
    from(event_state in LiveSessionTimelineEventState,
      where: event_state.timeline_event_id == ^timeline_event_id,
      lock: "FOR UPDATE",
      limit: 1
    )
  end

  @spec locked_chat_message_state_query(pos_integer()) :: Ecto.Query.t()
  defp locked_chat_message_state_query(target_event_id) when is_integer(target_event_id) do
    from(state in LiveSessionTimelineChatMessageState,
      where: state.timeline_event_id == ^target_event_id,
      lock: "FOR UPDATE"
    )
  end

  @spec chat_message_state_edit_attrs(
          LiveSessionTimelineChatMessageState.t(),
          LiveSessionTimelineEvent.t(),
          map()
        ) :: map()
  defp chat_message_state_edit_attrs(chat_message_state, edit_event, %{new_body: new_body}) do
    %{
      current_body: new_body,
      edit_count: chat_message_state.edit_count + 1,
      last_edit_event_id: edit_event.id,
      last_edited_at: edit_event.occurred_at,
      updated_at: edit_event.occurred_at
    }
  end

  @spec chat_message_edit_change_attrs(
          LiveSessionTimelineEvent.t(),
          pos_integer(),
          LiveSessionTimelineChatMessageState.t(),
          map()
        ) :: %{event: map(), chat_message_edit: map()}
  defp chat_message_edit_change_attrs(
         %LiveSessionTimelineEvent{
           id: target_event_id,
           live_session_id: live_session_id
         },
         actor_user_id,
         %LiveSessionTimelineChatMessageState{current_body: current_body},
         attrs
       ) do
    TimelineEventChanges.attrs_for_chat_message_edit_insert(
      live_session_id,
      actor_user_id,
      target_event_id,
      current_body,
      attrs,
      now_utc()
    )
  end

  @spec remove_chat_message_projection(
          repo(),
          LiveSessionTimelineEvent.t(),
          LiveSessionTimelineEventState.t(),
          pos_integer(),
          map()
        ) :: %{removed_event_id: pos_integer(), transitioned?: boolean()} | no_return()
  defp remove_chat_message_projection(
         _repo,
         %LiveSessionTimelineEvent{id: target_event_id},
         %LiveSessionTimelineEventState{projection_state: :hidden},
         _actor_user_id,
         _attrs
       )
       when is_integer(target_event_id) do
    %{removed_event_id: target_event_id, transitioned?: false}
  end

  defp remove_chat_message_projection(
         repo,
         %LiveSessionTimelineEvent{
           id: target_event_id,
           live_session_id: live_session_id,
           actor_user_id: target_user_id
         },
         %LiveSessionTimelineEventState{} = event_state,
         actor_user_id,
         attrs
       ) do
    now = now_utc()

    %{
      event: event_attrs,
      moderation_action: moderation_action_attrs,
      event_state: removal_event_state_attrs
    } =
      TimelineEventChanges.attrs_for_chat_message_removal_insert(
        live_session_id,
        actor_user_id,
        target_event_id,
        target_user_id,
        attrs,
        now
      )

    with {:ok, moderation_action} <- insert_moderation_action(repo, moderation_action_attrs),
         {:ok, removal_event} <- insert_timeline_event(repo, event_attrs),
         {:ok, _moderation_event} <-
           insert_timeline_moderation_event(repo, %{
             timeline_event_id: removal_event.id,
             live_session_id: live_session_id,
             moderation_action_id: moderation_action.id
           }),
         {:ok, _target_event_state} <-
           update_event_state(repo, event_state, %{
             projection_state: :hidden,
             superseded_by_event_id: removal_event.id,
             moderation_action_id: moderation_action.id,
             updated_at: now
           }),
         {:ok, _removal_event_state} <-
           insert_event_state(
             repo,
             Map.put(removal_event_state_attrs, :timeline_event_id, removal_event.id)
           ) do
      %{removed_event_id: target_event_id, transitioned?: true}
    else
      {:error, %Ecto.Changeset{} = changeset} -> repo.rollback(changeset)
    end
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

  @spec insert_chat_message_edit(repo(), map()) ::
          {:ok, LiveSessionTimelineChatMessageEdit.t()} | {:error, Ecto.Changeset.t()}
  defp insert_chat_message_edit(repo, attrs) do
    %LiveSessionTimelineChatMessageEdit{}
    |> TimelineEventChanges.chat_message_edit_changeset(attrs)
    |> repo.insert()
  end

  @spec insert_chat_message_state(repo(), map()) ::
          {:ok, LiveSessionTimelineChatMessageState.t()} | {:error, Ecto.Changeset.t()}
  defp insert_chat_message_state(repo, attrs) do
    %LiveSessionTimelineChatMessageState{}
    |> TimelineEventChanges.chat_message_state_changeset(attrs)
    |> repo.insert()
  end

  @spec insert_moderation_action(repo(), map()) ::
          {:ok, LiveSessionModerationAction.t()} | {:error, Ecto.Changeset.t()}
  defp insert_moderation_action(repo, attrs) do
    %LiveSessionModerationAction{}
    |> TimelineEventChanges.moderation_action_changeset(attrs)
    |> repo.insert()
  end

  @spec update_chat_message_state(repo(), LiveSessionTimelineChatMessageState.t(), map()) ::
          {:ok, LiveSessionTimelineChatMessageState.t()} | {:error, Ecto.Changeset.t()}
  defp update_chat_message_state(repo, %LiveSessionTimelineChatMessageState{} = state, attrs) do
    state
    |> TimelineEventChanges.chat_message_state_changeset(attrs)
    |> repo.update()
  end

  @spec update_event_state(repo(), LiveSessionTimelineEventState.t(), map()) ::
          {:ok, LiveSessionTimelineEventState.t()} | {:error, Ecto.Changeset.t()}
  defp update_event_state(repo, %LiveSessionTimelineEventState{} = state, attrs) do
    state
    |> TimelineEventChanges.event_state_changeset(attrs)
    |> repo.update()
  end

  @spec insert_event_state(repo(), map()) ::
          {:ok, LiveSessionTimelineEventState.t()} | {:error, Ecto.Changeset.t()}
  defp insert_event_state(repo, attrs) do
    %LiveSessionTimelineEventState{}
    |> TimelineEventChanges.event_state_changeset(attrs)
    |> repo.insert()
  end

  @spec insert_timeline_moderation_event(repo(), map()) ::
          {:ok, LiveSessionTimelineModerationEvent.t()} | {:error, Ecto.Changeset.t()}
  defp insert_timeline_moderation_event(repo, attrs) do
    %LiveSessionTimelineModerationEvent{}
    |> TimelineEventChanges.timeline_moderation_event_changeset(attrs)
    |> repo.insert()
  end

  @spec projection_for_event!(repo(), pos_integer()) :: TimelineProjection.t()
  defp projection_for_event!(repo, timeline_event_id) when is_integer(timeline_event_id) do
    timeline_event_id
    |> event_query()
    |> repo.one!()
  end

  @spec base_projection_query() :: Ecto.Query.t()
  defp base_projection_query do
    from(event_state in LiveSessionTimelineEventState,
      as: :event_state,
      join: event in assoc(event_state, :timeline_event),
      as: :event,
      left_join: chat_message_state in LiveSessionTimelineChatMessageState,
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
        edited: fragment("coalesce(?, 0) > 0", chat_message_state.edit_count),
        edit_count: type(fragment("coalesce(?, 0)", chat_message_state.edit_count), :integer),
        edited_at: chat_message_state.last_edited_at
      }
    )
  end
end
