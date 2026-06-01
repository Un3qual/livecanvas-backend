defmodule LCSchemas.Chat do
  @moduledoc false

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
