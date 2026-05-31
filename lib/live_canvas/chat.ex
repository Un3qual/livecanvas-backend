defmodule LC.Chat do
  @moduledoc """
  The Chat context.
  """

  use Boundary, deps: [LC.Infra, LC.ReadPolicy, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.Chat.{Broadcasts, History, SystemEvents}
  alias LC.Chat.ChatMessage, as: ChatMessageChanges
  alias LC.Infra.Repo
  alias LC.ReadPolicy
  alias LCSchemas.Accounts.User
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Live.LiveSession

  @type changeset :: Ecto.Changeset.t()
  @type authorize_join_result :: :ok | {:error, :not_authorized | :session_ended}
  @type authorize_history_result :: :ok | {:error, :not_authorized}
  @type chat_message_result ::
          {:ok, ChatMessage.t()} | {:error, changeset() | :not_authorized | :session_ended}
  @type system_event_opts :: [actor: User.t(), metadata: map()]
  @type system_event_result ::
          {:ok, ChatMessage.t()}
          | {:error, changeset() | :invalid_metadata | :not_authorized | :unknown_event_type}
  @type remove_message_result ::
          {:ok, ChatMessage.t()} | {:error, changeset() | :not_authorized | :not_found}
  @type remove_message_transition_result ::
          {:ok, ChatMessage.t(), boolean()}
          | {:error, changeset() | :not_authorized | :not_found}
  @type chat_transport_payload :: Broadcasts.message_payload()

  @doc """
  Authorizes whether the given viewer can join the provided live session topic.
  """
  @spec authorize_join(User.t(), LiveSession.t()) :: authorize_join_result()
  def authorize_join(%User{id: viewer_id}, %LiveSession{host_id: viewer_id})
      when is_integer(viewer_id) do
    # Channel assigns can be stale after moderation updates, so use persisted
    # account state for host self-joins.
    if active_user?(viewer_id), do: :ok, else: {:error, :not_authorized}
  end

  def authorize_join(%User{}, %LiveSession{status: :ended}), do: {:error, :session_ended}

  def authorize_join(
        %User{} = viewer,
        %LiveSession{} = live_session
      ) do
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
    # Retained chat stays readable after a stream ends, so history access
    # reuses visibility policy without the live-only ended-session rejection.
    authorize_visible_session_access(viewer, live_session)
  end

  @doc """
  Returns a deterministic history query for a live session's retained chat.
  """
  @spec history_query(LiveSession.t()) :: Ecto.Query.t()
  def history_query(%LiveSession{id: live_session_id}) when is_integer(live_session_id) do
    History.query(live_session_id)
  end

  @doc """
  Returns one retained chat message when the viewer can read its session history.
  """
  @spec get_history_message(User.t(), integer()) :: ChatMessage.t() | nil
  def get_history_message(%User{} = viewer, message_id)
      when is_integer(message_id) do
    with %ChatMessage{} = chat_message <- history_message_query(message_id) |> Repo.one(),
         :ok <- authorize_history_access(viewer, chat_message.live_session) do
      chat_message
    else
      _other -> nil
    end
  end

  def get_history_message(%User{}, _message_id), do: nil

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

  @doc """
  Persists a retained chat message for a live session.
  """
  @spec create_message(LiveSession.t(), User.t(), map()) :: chat_message_result()
  def create_message(
        %LiveSession{id: live_session_id} = live_session,
        %User{id: sender_id} = sender,
        attrs
      )
      when is_map(attrs) do
    with :ok <- authorize_join(sender, live_session),
         {:ok, chat_message} <-
           %ChatMessage{}
           |> ChatMessageChanges.changeset(
             ChatMessageChanges.attrs_for_insert(live_session_id, sender_id, attrs)
           )
           |> Repo.insert() do
      {:ok, chat_message}
    end
  end

  @doc """
  Persists a bounded system event for a live session.
  """
  @spec record_system_event(
          LiveSession.t(),
          LCSchemas.Chat.chat_system_event_type(),
          system_event_opts()
        ) ::
          system_event_result()
  def record_system_event(%LiveSession{} = live_session, event_type, opts)
      when is_atom(event_type) and is_list(opts) do
    with %User{} = actor <- Keyword.get(opts, :actor),
         :ok <- authorize_system_event_actor(live_session, actor),
         {:ok, attrs} <- SystemEvents.attrs_for_insert(live_session, actor, event_type, opts),
         {:ok, chat_message} <-
           %ChatMessage{}
           |> ChatMessageChanges.changeset(attrs)
           |> Repo.insert() do
      {:ok, chat_message}
    else
      nil -> {:error, :not_authorized}
      {:error, _reason} = error -> error
    end
  end

  @doc """
  Marks a retained chat message as removed when acted on by the owning session host.
  """
  @spec remove_message(ChatMessage.t(), User.t()) :: remove_message_result()
  def remove_message(%ChatMessage{id: message_id}, %User{id: actor_id})
      when is_integer(message_id) and is_integer(actor_id) do
    case remove_message_with_transition(%ChatMessage{id: message_id}, %User{id: actor_id}) do
      {:ok, chat_message, _transitioned?} -> {:ok, chat_message}
      {:error, _reason} = error -> error
    end
  end

  @doc """
  Marks a retained chat message as removed and reports whether this call won the
  persisted moderation state transition.
  """
  @spec remove_message_with_transition(ChatMessage.t(), User.t()) ::
          remove_message_transition_result()
  def remove_message_with_transition(%ChatMessage{id: message_id}, %User{id: actor_id})
      when is_integer(message_id) and is_integer(actor_id) do
    with %ChatMessage{} = chat_message <- removable_message_query(message_id) |> Repo.one(),
         :ok <- authorize_message_removal(chat_message, actor_id) do
      finalize_message_removal_with_transition(chat_message, actor_id)
    else
      nil -> {:error, :not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  @doc """
  Broadcasts a retained chat message over the shared live-session transport.
  """
  @spec broadcast_message(ChatMessage.t() | map(), String.t()) :: :ok
  def broadcast_message(chat_message, topic) when is_map(chat_message) do
    Broadcasts.broadcast_message(chat_message, topic)
  end

  @doc """
  Broadcasts an in-place retained chat message update over the shared transport.
  """
  @spec broadcast_message_update(ChatMessage.t() | map(), String.t()) :: :ok
  def broadcast_message_update(chat_message, topic) when is_map(chat_message) do
    Broadcasts.broadcast_message_update(chat_message, topic)
  end

  @doc """
  Builds the shared channel payload projection for a retained chat message.
  """
  @spec message_payload(ChatMessage.t() | map()) :: chat_transport_payload()
  def message_payload(chat_message) when is_map(chat_message) do
    Broadcasts.message_payload(chat_message)
  end

  @doc """
  Returns the client-visible body for a retained chat message.
  """
  @spec visible_body(ChatMessage.t() | map()) :: String.t() | nil
  def visible_body(chat_message) when is_map(chat_message) do
    ChatMessageChanges.visible_body(chat_message)
  end

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

  @spec history_message_query(integer()) :: Ecto.Query.t()
  defp history_message_query(message_id) when is_integer(message_id) do
    from(chat_message in ChatMessage,
      where: chat_message.id == ^message_id,
      join: live_session in assoc(chat_message, :live_session),
      preload: [:sender, live_session: live_session],
      limit: 1
    )
  end

  @spec removable_message_query(pos_integer()) :: Ecto.Query.t()
  defp removable_message_query(message_id) when is_integer(message_id) and message_id > 0 do
    from(chat_message in ChatMessage,
      where: chat_message.id == ^message_id,
      join: live_session in assoc(chat_message, :live_session),
      preload: [live_session: live_session],
      limit: 1
    )
  end

  @spec authorize_message_removal(ChatMessage.t(), pos_integer()) ::
          :ok | {:error, :not_authorized}
  defp authorize_message_removal(
         %ChatMessage{live_session: %LiveSession{host_id: host_id}},
         actor_id
       )
       when is_integer(host_id) and is_integer(actor_id) do
    # Removal authority belongs to the session host, not the message sender,
    # so viewers cannot delete their own persisted chat rows after the fact.
    if host_id == actor_id and active_user?(actor_id) do
      :ok
    else
      {:error, :not_authorized}
    end
  end

  defp authorize_message_removal(%ChatMessage{}, _actor_id), do: {:error, :not_authorized}

  @spec authorize_system_event_actor(LiveSession.t(), User.t()) ::
          :ok | {:error, :not_authorized}
  defp authorize_system_event_actor(
         %LiveSession{host_id: host_id},
         %User{id: actor_id}
       )
       when is_integer(host_id) and is_integer(actor_id) do
    # The initial system-event vocabulary is host-owned only until reconnect-
    # safe participant event deduplication exists.
    if host_id == actor_id and active_user?(actor_id) do
      :ok
    else
      {:error, :not_authorized}
    end
  end

  @spec finalize_message_removal_with_transition(ChatMessage.t(), pos_integer()) ::
          remove_message_transition_result()
  defp finalize_message_removal_with_transition(
         %ChatMessage{status: :removed} = chat_message,
         _actor_id
       ),
       do: {:ok, chat_message, false}

  defp finalize_message_removal_with_transition(%ChatMessage{id: message_id}, actor_id)
       when is_integer(message_id) and is_integer(actor_id) do
    moderated_at = now_utc()

    # Competing host removals can race after both readers observe `:active`, so
    # keep the state transition in one conditional update and then reload the
    # row. Later contenders reuse the first persisted moderation timestamp.
    {updated_count, _} =
      from(chat_message in ChatMessage,
        where: chat_message.id == ^message_id and chat_message.status != :removed
      )
      |> Repo.update_all(
        set: [status: :removed, moderated_at: moderated_at, moderated_by_id: actor_id]
      )

    case removable_message_query(message_id) |> Repo.one() do
      %ChatMessage{} = chat_message -> {:ok, chat_message, updated_count == 1}
      nil -> {:error, :not_found}
    end
  end

  @spec now_utc() :: DateTime.t()
  defp now_utc do
    DateTime.utc_now() |> DateTime.truncate(:microsecond)
  end
end
