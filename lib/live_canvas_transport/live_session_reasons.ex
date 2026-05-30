defmodule LCTransport.LiveSessionReasons do
  @moduledoc """
  Client-facing reason strings for live-session Phoenix socket payloads.
  """

  @type reason_string :: String.t()
  @type chat_send_error ::
          :session_ended
          | :not_authorized
          | :invalid_body
          | :rate_limited
          | Ecto.Changeset.t()
  @type disconnect_error :: :session_ended | :viewer_left

  @spec join_error_reason(term()) :: reason_string()
  def join_error_reason(:ended), do: "session_ended"
  def join_error_reason(:not_found), do: "session_not_found"
  def join_error_reason(:invalid_session_id), do: "invalid_session_id"
  def join_error_reason(:session_ended), do: "session_ended"
  def join_error_reason(:not_authorized), do: "not_authorized"
  def join_error_reason(:rate_limited), do: "rate_limited"
  def join_error_reason({:owned_by_remote, _owner_node}), do: "session_unavailable"

  def join_error_reason(reason)
      when reason in [:remote_not_found, :remote_timeout, :remote_unreachable],
      do: "session_unavailable"

  def join_error_reason(_reason), do: "join_failed"

  @spec chat_send_error_reason(chat_send_error()) :: reason_string()
  def chat_send_error_reason(:session_ended), do: "session_ended"
  def chat_send_error_reason(:not_authorized), do: "not_authorized"
  def chat_send_error_reason(:invalid_body), do: "invalid_body"
  def chat_send_error_reason(:rate_limited), do: "rate_limited"
  def chat_send_error_reason(%Ecto.Changeset{}), do: "invalid_message"

  @spec disconnect_reason(disconnect_error()) :: reason_string()
  def disconnect_reason(:session_ended), do: "session_ended"
  def disconnect_reason(:viewer_left), do: "viewer_left"
end
