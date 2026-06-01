defmodule LCSchemas.Chat do
  @moduledoc false

  @type chat_message_kind :: :system_event | :user_message
  @type chat_message_status :: :active | :removed
  @type chat_system_event_type :: :message_removed | :session_ended | :session_live
  @type chat_system_event_details :: %{optional(String.t()) => Ecto.UUID.t() | pos_integer()}
  @type chat_system_event_metadata :: %{optional(String.t()) => term()}
  @type chat_message_metadata :: chat_system_event_metadata() | map()

  @type timeline_event_type ::
          :chat_message_sent
          | :chat_message_edited
          | :chat_message_removed
          | :live_session_started
          | :live_session_ended

  @type timeline_projection_state :: :visible | :hidden | :redacted_placeholder | :internal
  @type chat_message_body_format :: :plain
  @type moderation_action_type :: :message_removed | :user_muted | :user_banned
end
