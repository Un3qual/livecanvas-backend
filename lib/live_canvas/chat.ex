defmodule LC.Chat do
  @moduledoc """
  The Chat context.
  """

  use Boundary, deps: [LC.Infra, LC.Social, LCSchemas]

  alias LC.Chat.ChatMessage, as: ChatMessageChanges
  alias LC.Infra.Repo
  alias LC.Social
  alias LCSchemas.Accounts.User
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Live.LiveSession

  @type changeset :: Ecto.Changeset.t()
  @type authorize_join_result :: :ok | {:error, :not_authorized | :session_ended}
  @type chat_message_result ::
          {:ok, ChatMessage.t()} | {:error, changeset() | :not_authorized | :session_ended}

  @doc """
  Authorizes whether the given viewer can join the provided live session topic.
  """
  @spec authorize_join(User.t(), LiveSession.t()) :: authorize_join_result()
  def authorize_join(%User{id: viewer_id}, %LiveSession{host_id: viewer_id}), do: :ok

  def authorize_join(%User{}, %LiveSession{status: :ended}), do: {:error, :session_ended}

  def authorize_join(%User{} = viewer, %LiveSession{host_id: host_id, visibility: visibility})
      when visibility in [:followers, :public] do
    with %User{} = host <- Repo.get(User, host_id) do
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
      nil -> {:error, :not_authorized}
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
end
