defmodule LCTransport.LiveSessionTopics do
  @moduledoc """
  Shared Phoenix topic contract for live-session transport.
  """

  @type parse_result :: {:ok, pos_integer()} | {:error, :invalid_session_id}

  @spec live_session_topic(integer()) :: String.t()
  def live_session_topic(session_id) when is_integer(session_id), do: "live_session:#{session_id}"

  @spec media_signaling_topic(integer()) :: String.t()
  def media_signaling_topic(session_id) when is_integer(session_id),
    do: "live_session_media:#{session_id}"

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

  @spec parse_media_signaling_topic(String.t()) :: parse_result()
  def parse_media_signaling_topic("live_session_media:" <> raw_session_id),
    do: parse_session_id(raw_session_id)

  def parse_media_signaling_topic(_topic), do: {:error, :invalid_session_id}

  @spec parse_channel_topic(String.t()) ::
          {:ok, pos_integer(), :live_session | :media_signaling}
          | {:error, :invalid_session_id}
  def parse_channel_topic("live_session:" <> _raw_session_id = topic) do
    with {:ok, session_id} <- parse_live_session_topic(topic) do
      {:ok, session_id, :live_session}
    end
  end

  def parse_channel_topic("live_session_media:" <> _raw_session_id = topic) do
    with {:ok, session_id} <- parse_media_signaling_topic(topic) do
      {:ok, session_id, :media_signaling}
    end
  end

  def parse_channel_topic(_topic), do: {:error, :invalid_session_id}

  @spec session_id_hint(term()) :: pos_integer() | nil
  def session_id_hint(topic) when is_binary(topic) do
    case parse_channel_topic(topic) do
      {:ok, session_id, _scope} -> session_id
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
