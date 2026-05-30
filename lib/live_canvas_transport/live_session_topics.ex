defmodule LCTransport.LiveSessionTopics do
  @moduledoc """
  Shared Phoenix topic contract for live-session transport.
  """

  @type parse_result :: {:ok, pos_integer()} | {:error, :invalid_session_id}

  @spec live_session_topic(integer()) :: String.t()
  def live_session_topic(session_id) when is_integer(session_id), do: "live_session:#{session_id}"

  @spec session_control_topic(integer()) :: String.t()
  def session_control_topic(session_id) when is_integer(session_id),
    do: "live_session_control:#{session_id}"

  @spec session_user_control_topic(integer(), integer()) :: String.t()
  def session_user_control_topic(session_id, user_id)
      when is_integer(session_id) and is_integer(user_id),
      do: "live_session_control:#{session_id}:user:#{user_id}"

  @spec parse_live_session_topic(String.t()) :: parse_result()
  def parse_live_session_topic("live_session:" <> raw_session_id),
    do: parse_session_id(raw_session_id)

  def parse_live_session_topic(_topic), do: {:error, :invalid_session_id}

  @spec session_id_hint(term()) :: pos_integer() | nil
  def session_id_hint(topic) when is_binary(topic) do
    case parse_live_session_topic(topic) do
      {:ok, session_id} -> session_id
      {:error, :invalid_session_id} -> nil
    end
  end

  def session_id_hint(_topic), do: nil

  @spec parse_session_id(String.t()) :: parse_result()
  defp parse_session_id(raw_session_id) do
    case Integer.parse(raw_session_id) do
      {session_id, ""} when session_id > 0 -> {:ok, session_id}
      _other -> {:error, :invalid_session_id}
    end
  end
end
