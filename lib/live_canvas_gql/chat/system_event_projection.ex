defmodule LCGQL.Chat.SystemEventProjection do
  @moduledoc false

  @type details :: %{
          optional(:chat_message_entropy_id) => Ecto.UUID.t(),
          optional(:chat_message_id) => String.t()
        }

  @spec event_type(map()) :: LCSchemas.Chat.chat_system_event_type() | nil
  def event_type(%{kind: kind, metadata: metadata})
      when kind in [:system_event, "system_event"] and is_map(metadata) do
    metadata
    |> Map.get("event_type")
    |> cast_event_type()
  end

  def event_type(_chat_message), do: nil

  @spec details(map()) :: details() | nil
  def details(%{metadata: %{"details" => details}} = chat_message) when is_map(details) do
    if is_nil(event_type(chat_message)) do
      nil
    else
      details
      |> detail_payload()
      |> empty_to_nil()
    end
  end

  def details(_chat_message), do: nil

  @spec cast_event_type(term()) :: LCSchemas.Chat.chat_system_event_type() | nil
  defp cast_event_type("message_removed"), do: :message_removed
  defp cast_event_type("session_ended"), do: :session_ended
  defp cast_event_type("session_live"), do: :session_live
  defp cast_event_type(_event_type), do: nil

  @spec detail_payload(map()) :: details()
  defp detail_payload(details) do
    %{}
    |> put_chat_message_id(details)
    |> put_chat_message_entropy_id(details)
  end

  @spec put_chat_message_id(details(), map()) :: details()
  defp put_chat_message_id(payload, %{"chat_message_id" => chat_message_id})
       when is_integer(chat_message_id) and chat_message_id > 0 do
    Map.put(
      payload,
      :chat_message_id,
      Absinthe.Relay.Node.to_global_id(:chat_message, chat_message_id, LCGQL.Schema)
    )
  end

  defp put_chat_message_id(payload, _details), do: payload

  @spec put_chat_message_entropy_id(details(), map()) :: details()
  defp put_chat_message_entropy_id(payload, %{"chat_message_entropy_id" => entropy_id})
       when is_binary(entropy_id) do
    Map.put(payload, :chat_message_entropy_id, entropy_id)
  end

  defp put_chat_message_entropy_id(payload, _details), do: payload

  @spec empty_to_nil(details()) :: details() | nil
  defp empty_to_nil(payload) when map_size(payload) == 0, do: nil
  defp empty_to_nil(payload), do: payload
end
