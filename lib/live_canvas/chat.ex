defmodule LC.Chat do
  @moduledoc """
  The Chat context.
  """

  use Boundary, deps: [LC.Infra, LC.Social, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.Chat.History
  alias LC.Chat.ChatMessage, as: ChatMessageChanges
  alias LC.Infra.Repo
  alias LC.Social
  alias LCSchemas.Accounts.User
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Live.LiveSession

  @type changeset :: Ecto.Changeset.t()
  @type authorize_join_result :: :ok | {:error, :not_authorized | :session_ended}
  @type authorize_history_result :: :ok | {:error, :not_authorized}
  @type chat_message_result ::
          {:ok, ChatMessage.t()} | {:error, changeset() | :not_authorized | :session_ended}
  @type remove_message_result ::
          {:ok, ChatMessage.t()} | {:error, changeset() | :not_authorized | :not_found}

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
  @spec get_history_message(User.t(), pos_integer()) :: ChatMessage.t() | nil
  def get_history_message(%User{} = viewer, message_id)
      when is_integer(message_id) and message_id > 0 do
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
         %User{} = host <- active_host(host_id) do
      # Mute checks are directional: a viewer muting the host prevents joining
      # that host's chat even when the session is otherwise visible.
      if Social.muted?(viewer, host) do
        {:error, :not_authorized}
      else
        relationship_state = Social.relationship_state(viewer, host)

        # Session visibility is evaluated after block policy so public sessions
        # cannot bypass an explicit block.
        case {visibility, relationship_state} do
          {_visibility, :blocked} -> {:error, :not_authorized}
          {:public, _state} -> :ok
          {:followers, :accepted} -> :ok
          _other -> {:error, :not_authorized}
        end
      end
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
  Marks a retained chat message as removed when acted on by the owning session host.
  """
  @spec remove_message(ChatMessage.t(), User.t()) :: remove_message_result()
  def remove_message(%ChatMessage{id: message_id}, %User{id: actor_id})
      when is_integer(message_id) and is_integer(actor_id) do
    with %ChatMessage{} = chat_message <- removable_message_query(message_id) |> Repo.one(),
         :ok <- authorize_message_removal(chat_message, actor_id) do
      if chat_message.status == :removed do
        {:ok, chat_message}
      else
        chat_message
        |> ChatMessageChanges.removal_changeset(actor_id, now_utc())
        |> Repo.update()
      end
    else
      nil -> {:error, :not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

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

  @spec history_message_query(pos_integer()) :: Ecto.Query.t()
  defp history_message_query(message_id) when is_integer(message_id) and message_id > 0 do
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
  defp authorize_message_removal(%ChatMessage{live_session: %LiveSession{host_id: host_id}}, actor_id)
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

  @spec now_utc() :: DateTime.t()
  defp now_utc do
    DateTime.utc_now() |> DateTime.truncate(:microsecond)
  end
end
