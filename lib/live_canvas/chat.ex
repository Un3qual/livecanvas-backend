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
end
