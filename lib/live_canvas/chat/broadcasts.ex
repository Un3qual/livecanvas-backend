defmodule LC.Chat.Broadcasts do
  @moduledoc false

  alias LC.Chat.ChatMessage, as: ChatMessageChanges
  alias Phoenix.Socket.Broadcast

  @type message_payload :: %{
          id: pos_integer() | nil,
          body: String.t() | nil,
          sender_id: pos_integer() | nil,
          inserted_at: String.t() | nil,
          kind: String.t(),
          status: String.t(),
          moderated_at: String.t() | nil,
          metadata: map()
        }

  @spec broadcast_message(map()) :: :ok
  def broadcast_message(%{live_session_id: live_session_id} = chat_message)
      when is_integer(live_session_id) do
    topic = live_session_topic(live_session_id)

    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{topic: topic, event: "chat:message", payload: %{message: message_payload(chat_message)}}
    )
  end

  def broadcast_message(_chat_message), do: :ok

  @spec broadcast_message_update(map()) :: :ok
  def broadcast_message_update(%{live_session_id: live_session_id} = chat_message)
      when is_integer(live_session_id) do
    topic = live_session_topic(live_session_id)

    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{
        topic: topic,
        event: "chat:message_updated",
        payload: %{message: message_payload(chat_message)}
      }
    )
  end

  def broadcast_message_update(_chat_message), do: :ok

  @spec message_payload(map()) :: message_payload()
  def message_payload(chat_message) when is_map(chat_message) do
    %{
      id: Map.get(chat_message, :id),
      body: ChatMessageChanges.visible_body(chat_message),
      sender_id: Map.get(chat_message, :sender_id),
      inserted_at: iso8601(Map.get(chat_message, :inserted_at)),
      kind: kind_string(Map.get(chat_message, :kind, :user_message)),
      status: status_string(Map.get(chat_message, :status, :active)),
      moderated_at: iso8601(Map.get(chat_message, :moderated_at)),
      metadata: normalize_metadata(Map.get(chat_message, :metadata, %{}))
    }
  end

  @spec live_session_topic(pos_integer()) :: String.t()
  defp live_session_topic(live_session_id) when is_integer(live_session_id),
    do: "live_session:#{live_session_id}"

  @spec iso8601(DateTime.t() | nil) :: String.t() | nil
  defp iso8601(%DateTime{} = datetime), do: DateTime.to_iso8601(datetime)
  defp iso8601(_datetime), do: nil

  @spec kind_string(atom() | String.t()) :: String.t()
  defp kind_string(kind) when is_atom(kind), do: Atom.to_string(kind)
  defp kind_string(kind) when is_binary(kind), do: kind
  defp kind_string(_kind), do: "user_message"

  @spec status_string(atom() | String.t()) :: String.t()
  defp status_string(status) when is_atom(status), do: Atom.to_string(status)
  defp status_string(status) when is_binary(status), do: status
  defp status_string(_status), do: "active"

  @spec normalize_metadata(term()) :: map()
  defp normalize_metadata(metadata) when is_map(metadata), do: metadata
  defp normalize_metadata(_metadata), do: %{}
end
