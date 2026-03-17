defmodule LCSchemas.Chat do
  @moduledoc false

  @type chat_message_kind :: :system_event | :user_message
  @type chat_message_status :: :active | :removed
  @type chat_system_event_type :: :message_removed | :session_ended | :session_live
  @type chat_system_event_details :: %{optional(String.t()) => Ecto.UUID.t() | pos_integer()}
  @type chat_system_event_metadata :: %{optional(String.t()) => term()}
  @type chat_message_metadata :: chat_system_event_metadata() | map()
end
