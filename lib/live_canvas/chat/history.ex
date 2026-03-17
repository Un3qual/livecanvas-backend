defmodule LC.Chat.History do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LCSchemas.Chat.ChatMessage

  @spec query(pos_integer()) :: Ecto.Query.t()
  def query(live_session_id) when is_integer(live_session_id) do
    from(chat_message in ChatMessage,
      where: chat_message.live_session_id == ^live_session_id,
      # Relay cursors need a total ordering, so break inserted_at ties on id.
      order_by: [asc: chat_message.inserted_at, asc: chat_message.id]
    )
  end
end
