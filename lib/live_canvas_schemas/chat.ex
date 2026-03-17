defmodule LCSchemas.Chat do
  @moduledoc false

  @type chat_message_kind :: :system_event | :user_message
  @type chat_message_status :: :active | :removed
end
