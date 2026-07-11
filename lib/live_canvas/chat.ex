defmodule LC.Chat do
  @moduledoc """
  The Chat context.
  """

  use Boundary, deps: [LC.Infra, LC.ReadPolicy, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.Chat.{TimelineBroadcasts, TimelineEvents, TimelineProjection}
  alias LC.Infra.Repo
  alias LC.ReadPolicy
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @type changeset :: Ecto.Changeset.t()
  @type authorize_join_result :: :ok | {:error, :not_authorized | :session_ended}
  @type authorize_history_result :: :ok | {:error, :not_authorized}
  @type timeline_chat_message_result ::
          {:ok, TimelineProjection.t()}
          | {:error, changeset() | :not_authorized | :session_ended}
  @type timeline_chat_message_edit_result ::
          {:ok, TimelineProjection.t()}
          | {:error, changeset() | :not_authorized | :not_found | :hidden | :session_ended}
  @type timeline_chat_message_removal_result ::
          {:ok, %{removed_event_id: pos_integer(), transitioned?: boolean()}}
          | {:error, changeset() | :not_authorized | :not_found | :not_chat_message}
  @type lifecycle_timeline_event_opts :: [actor: User.t()]
  @type lifecycle_timeline_event_result ::
          {:ok, TimelineProjection.t()} | {:error, :not_authorized | changeset()}
  @type timeline_event_transport_payload :: TimelineBroadcasts.event_payload()

  @doc """
  Authorizes whether the given viewer can join the provided live session topic.
  """
  @spec authorize_join(User.t(), LiveSession.t()) :: authorize_join_result()
  def authorize_join(%User{}, %LiveSession{status: :ended}), do: {:error, :session_ended}

  def authorize_join(%User{id: viewer_id}, %LiveSession{host_id: viewer_id})
      when is_integer(viewer_id) do
    # Channel assigns can be stale after moderation updates, so use persisted
    # account state for host self-joins.
    if active_user?(viewer_id), do: :ok, else: {:error, :not_authorized}
  end

  def authorize_join(%User{} = viewer, %LiveSession{} = live_session) do
    authorize_visible_session_access(viewer, live_session)
  end

  @doc """
  Authorizes whether the given viewer can read retained history for a live session.
  """
  @spec authorize_history_access(User.t(), LiveSession.t()) :: authorize_history_result()
  def authorize_history_access(%User{id: viewer_id}, %LiveSession{host_id: viewer_id})
      when is_integer(viewer_id) do
    if active_user?(viewer_id), do: :ok, else: {:error, :not_authorized}
  end

  def authorize_history_access(%User{} = viewer, %LiveSession{} = live_session) do
    # Retained history stays readable after a stream ends, so history access
    # reuses visibility policy without the live-only ended-session rejection.
    authorize_visible_session_access(viewer, live_session)
  end

  @doc """
  Returns a deterministic visible timeline projection query for a live session's retained chat.
  """
  @spec timeline_history_query(LiveSession.t()) :: Ecto.Query.t()
  def timeline_history_query(%LiveSession{id: live_session_id})
      when is_integer(live_session_id) do
    TimelineEvents.history_query(live_session_id)
  end

  @doc """
  Returns timeline projections after excluding actors who blocked the viewer.
  """
  @spec timeline_history_query(User.t(), LiveSession.t()) :: Ecto.Query.t()
  def timeline_history_query(%User{id: viewer_id}, %LiveSession{id: live_session_id})
      when is_integer(viewer_id) and is_integer(live_session_id) do
    TimelineEvents.history_query(live_session_id, viewer_id)
  end

  @doc """
  Returns one visible timeline event when the viewer can read its session history.
  """
  @spec get_timeline_event(User.t(), integer()) :: TimelineProjection.t() | nil
  def get_timeline_event(%User{} = viewer, timeline_event_id)
      when is_integer(timeline_event_id) do
    with %{live_session_id: live_session_id} = timeline_event <-
           timeline_event_id |> TimelineEvents.event_query(viewer.id) |> Repo.one(),
         %LiveSession{} = live_session <- Repo.get(LiveSession, live_session_id),
         :ok <- authorize_history_access(viewer, live_session) do
      timeline_event
    else
      _other -> nil
    end
  end

  def get_timeline_event(%User{}, _timeline_event_id), do: nil

  @doc """
  Returns one timeline event for a moderation attempt.

  Active session hosts bypass actor-to-host block visibility so an event author
  cannot prevent moderation. Other viewers retain the normal visibility policy.
  """
  @spec get_timeline_event_for_moderation(User.t(), integer()) :: TimelineProjection.t() | nil
  def get_timeline_event_for_moderation(%User{} = viewer, timeline_event_id)
      when is_integer(timeline_event_id) do
    with %{live_session_id: live_session_id} = timeline_event <-
           timeline_event_id |> TimelineEvents.event_query() |> Repo.one(),
         %LiveSession{} = live_session <- Repo.get(LiveSession, live_session_id),
         :ok <- authorize_timeline_host_actor(live_session, viewer) do
      timeline_event
    else
      {:error, :not_authorized} -> get_timeline_event(viewer, timeline_event_id)
      _other -> nil
    end
  end

  def get_timeline_event_for_moderation(%User{}, _timeline_event_id), do: nil

  @doc """
  Persists an append-only timeline chat message event and its current projection.
  """
  @spec create_timeline_chat_message(LiveSession.t(), User.t(), map()) ::
          timeline_chat_message_result()
  def create_timeline_chat_message(
        %LiveSession{id: live_session_id},
        %User{} = sender,
        attrs
      )
      when is_integer(live_session_id) and is_map(attrs) do
    with %LiveSession{} = persisted_live_session <- Repo.get(LiveSession, live_session_id),
         :ok <- authorize_join(sender, persisted_live_session) do
      TimelineEvents.create_chat_message(Repo, persisted_live_session, sender, attrs)
    else
      nil -> {:error, :session_ended}
      {:error, _reason} = error -> error
    end
  end

  @doc """
  Persists an append-only timeline chat message edit and returns the updated projection.
  """
  @spec edit_timeline_chat_message(TimelineProjection.t() | map(), User.t(), map()) ::
          timeline_chat_message_edit_result()
  def edit_timeline_chat_message(timeline_event, %User{} = actor, attrs)
      when is_map(timeline_event) and is_map(attrs) do
    TimelineEvents.edit_chat_message(
      Repo,
      timeline_event,
      actor,
      attrs,
      &authorize_timeline_chat_edit_join/2
    )
  end

  @doc """
  Hides a timeline chat message projection and records the durable moderation facts.
  """
  @spec remove_timeline_chat_message(TimelineProjection.t() | map(), User.t(), map()) ::
          timeline_chat_message_removal_result()
  def remove_timeline_chat_message(timeline_event, %User{} = actor, attrs)
      when is_map(timeline_event) and is_map(attrs) do
    TimelineEvents.remove_chat_message(
      Repo,
      timeline_event,
      actor,
      attrs,
      &authorize_timeline_host_actor/2
    )
  end

  @doc """
  Persists a first-class lifecycle timeline event for a live session.
  """
  @spec record_lifecycle_timeline_event(
          LiveSession.t(),
          :live_session_started | :live_session_ended,
          lifecycle_timeline_event_opts()
        ) :: lifecycle_timeline_event_result()
  def record_lifecycle_timeline_event(%LiveSession{} = live_session, event_type, opts)
      when event_type in [:live_session_started, :live_session_ended] and is_list(opts) do
    with %User{} = actor <- Keyword.get(opts, :actor),
         :ok <- authorize_timeline_host_actor(live_session, actor) do
      TimelineEvents.record_lifecycle_event(Repo, live_session, actor, event_type)
    else
      nil -> {:error, :not_authorized}
      {:error, _reason} = error -> error
    end
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  @doc """
  Broadcasts a timeline event over the shared live-session transport.
  """
  @spec broadcast_timeline_event(TimelineProjection.t() | map(), String.t()) :: :ok
  def broadcast_timeline_event(timeline_event, topic)
      when is_map(timeline_event) and is_binary(topic) do
    TimelineBroadcasts.broadcast_event(
      timeline_event,
      topic,
      hidden_timeline_viewer_ids(timeline_event)
    )
  end

  def broadcast_timeline_event(_timeline_event, _topic), do: :ok

  @doc """
  Broadcasts an in-place timeline event update over the shared live-session transport.
  """
  @spec broadcast_timeline_event_update(TimelineProjection.t() | map(), String.t()) :: :ok
  def broadcast_timeline_event_update(timeline_event, topic)
      when is_map(timeline_event) and is_binary(topic) do
    TimelineBroadcasts.broadcast_event_update(
      timeline_event,
      topic,
      hidden_timeline_viewer_ids(timeline_event)
    )
  end

  def broadcast_timeline_event_update(_timeline_event, _topic), do: :ok

  @doc """
  Broadcasts that a visible timeline event has been removed from the shared transport.
  """
  @spec broadcast_timeline_event_removed(pos_integer(), String.t()) :: :ok
  def broadcast_timeline_event_removed(timeline_event_id, topic)
      when is_integer(timeline_event_id) and timeline_event_id > 0 and is_binary(topic) do
    TimelineBroadcasts.broadcast_event_removed(timeline_event_id, topic)
  end

  def broadcast_timeline_event_removed(_timeline_event_id, _topic), do: :ok

  @doc """
  Builds the shared channel payload projection for a timeline event.
  """
  @spec timeline_event_payload(TimelineProjection.t()) :: timeline_event_transport_payload()
  def timeline_event_payload(timeline_event) when is_map(timeline_event) do
    TimelineBroadcasts.event_payload(timeline_event)
  end

  @doc false
  @spec timeline_broadcast_visible_to_viewer?(map(), pos_integer()) :: boolean()
  def timeline_broadcast_visible_to_viewer?(payload, viewer_id)
      when is_map(payload) and is_integer(viewer_id) do
    TimelineBroadcasts.visible_to_viewer?(payload, viewer_id)
  end

  @doc false
  @spec public_timeline_broadcast_payload(map()) :: map()
  def public_timeline_broadcast_payload(payload) when is_map(payload),
    do: TimelineBroadcasts.public_broadcast_payload(payload)

  @spec hidden_timeline_viewer_ids(TimelineProjection.t() | map()) :: [pos_integer()]
  defp hidden_timeline_viewer_ids(%{actor_user_id: actor_user_id})
       when is_integer(actor_user_id) do
    ReadPolicy.blocked_peer_ids(%User{id: actor_user_id})
  end

  defp hidden_timeline_viewer_ids(_timeline_event), do: []

  @spec active_host(pos_integer()) :: User.t() | nil
  defp active_host(host_id) when is_integer(host_id) do
    from(user in User, where: user.id == ^host_id and is_nil(user.suspended_at))
    |> Repo.one()
  end

  @spec active_user?(pos_integer()) :: boolean()
  defp active_user?(user_id) when is_integer(user_id) do
    from(user in User, where: user.id == ^user_id and is_nil(user.suspended_at), select: user.id)
    |> Repo.exists?()
  end

  @spec authorize_visible_session_access(User.t(), LiveSession.t()) ::
          :ok | {:error, :not_authorized}
  defp authorize_visible_session_access(
         %User{id: viewer_id} = viewer,
         %LiveSession{host_id: host_id, visibility: visibility}
       )
       when visibility in [:followers, :public] and is_integer(viewer_id) and is_integer(host_id) do
    # Always re-check moderation state in the database before evaluating social
    # policy so suspended users cannot use stale socket identity data.
    with true <- active_user?(viewer_id),
         %User{} = host <- active_host(host_id),
         true <- ReadPolicy.viewer_can_read_owner?(viewer, host, visibility) do
      :ok
    else
      _other -> {:error, :not_authorized}
    end
  end

  @spec authorize_timeline_chat_edit_join(User.t(), LiveSession.t()) :: authorize_join_result()
  defp authorize_timeline_chat_edit_join(%User{}, %LiveSession{status: :ended}),
    do: {:error, :session_ended}

  defp authorize_timeline_chat_edit_join(%User{} = actor, %LiveSession{} = live_session) do
    authorize_join(actor, live_session)
  end

  @spec authorize_timeline_host_actor(LiveSession.t(), User.t()) ::
          :ok | {:error, :not_authorized}
  defp authorize_timeline_host_actor(
         %LiveSession{host_id: host_id},
         %User{id: actor_id}
       )
       when is_integer(host_id) and is_integer(actor_id) do
    if host_id == actor_id and active_user?(actor_id) do
      :ok
    else
      {:error, :not_authorized}
    end
  end
end
