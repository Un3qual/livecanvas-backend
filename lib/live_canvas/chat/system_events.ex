defmodule LC.Chat.SystemEvents do
  @moduledoc false

  alias LC.Chat.ChatMessage, as: ChatMessageChanges
  alias LCSchemas.Accounts.User
  alias LCSchemas.Chat.ChatMessage, as: ChatMessageSchema
  alias LCSchemas.Live.LiveSession

  @type event_type :: LCSchemas.Chat.chat_system_event_type()
  @type error :: :invalid_metadata | :unknown_event_type
  @type opts :: [metadata: map()]

  @session_live_body "The live session started."
  @session_ended_body "The live session ended."
  @message_removed_body "A chat message was removed."

  @spec attrs_for_insert(LiveSession.t(), User.t(), event_type(), opts()) ::
          {:ok, ChatMessageChanges.attrs()} | {:error, error()}
  def attrs_for_insert(
        %LiveSession{id: live_session_id},
        %User{id: actor_id},
        event_type,
        opts
      )
      when is_integer(live_session_id) and is_integer(actor_id) and is_atom(event_type) and
             is_list(opts) do
    with {:ok, body, details} <- normalize_event(event_type, Keyword.get(opts, :metadata, %{})) do
      {:ok,
       %{
         body: body,
         kind: :system_event,
         live_session_id: live_session_id,
         metadata: %{
           "details" => details,
           "event_type" => Atom.to_string(event_type)
         },
         sender_id: actor_id,
         status: :active
       }}
    end
  end

  # Join/leave events stay out of the first vocabulary because reconnect-driven
  # channel churn would create noisy durable history before deduplication exists.
  @spec normalize_event(event_type(), map()) ::
          {:ok, String.t(), LCSchemas.Chat.chat_system_event_details()} | {:error, error()}
  defp normalize_event(:session_live, _metadata), do: {:ok, @session_live_body, %{}}
  defp normalize_event(:session_ended, _metadata), do: {:ok, @session_ended_body, %{}}

  defp normalize_event(:message_removed, metadata) when is_map(metadata) do
    with {:ok, details} <- normalize_message_removed_details(metadata) do
      {:ok, @message_removed_body, details}
    end
  end

  defp normalize_event(:message_removed, _metadata), do: {:error, :invalid_metadata}
  defp normalize_event(_event_type, _metadata), do: {:error, :unknown_event_type}

  @spec normalize_message_removed_details(map()) ::
          {:ok, LCSchemas.Chat.chat_system_event_details()} | {:error, :invalid_metadata}
  defp normalize_message_removed_details(metadata) when is_map(metadata) do
    with {:ok, {chat_message_id, entropy_id}} <- message_reference(metadata) do
      {:ok,
       %{
         "chat_message_entropy_id" => entropy_id,
         "chat_message_id" => chat_message_id
       }}
    end
  end

  @spec message_reference(map()) ::
          {:ok, {pos_integer(), Ecto.UUID.t()}} | {:error, :invalid_metadata}
  defp message_reference(metadata) when is_map(metadata) do
    case value_for(metadata, :chat_message) do
      %ChatMessageSchema{id: id, entropy_id: entropy_id} ->
        normalize_message_reference(id, entropy_id)

      _other ->
        normalize_message_reference(
          value_for(metadata, :chat_message_id),
          value_for(metadata, :chat_message_entropy_id)
        )
    end
  end

  @spec normalize_message_reference(term(), term()) ::
          {:ok, {pos_integer(), Ecto.UUID.t()}} | {:error, :invalid_metadata}
  defp normalize_message_reference(chat_message_id, entropy_id)
       when is_integer(chat_message_id) and chat_message_id > 0 do
    with {:ok, cast_entropy_id} <- cast_entropy_id(entropy_id) do
      {:ok, {chat_message_id, cast_entropy_id}}
    end
  end

  defp normalize_message_reference(_chat_message_id, _entropy_id),
    do: {:error, :invalid_metadata}

  @spec cast_entropy_id(term()) :: {:ok, Ecto.UUID.t()} | {:error, :invalid_metadata}
  defp cast_entropy_id(entropy_id) do
    case Ecto.UUID.cast(entropy_id) do
      {:ok, cast_entropy_id} -> {:ok, cast_entropy_id}
      :error -> {:error, :invalid_metadata}
    end
  end

  defp value_for(attrs, key) when is_map(attrs) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
  end
end
