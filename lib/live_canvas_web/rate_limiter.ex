defmodule LCWeb.RateLimiter do
  @moduledoc false

  @type limit_key ::
          :auth_login | :graphql_mutation | :moderation_action | :channel_join | :chat_send
  @type allow_result :: :ok | {:error, :rate_limited}
  @type rate_limit_config :: [limit: pos_integer(), window_ms: pos_integer()]

  @table __MODULE__
  @default_limits [
    auth_login: [limit: 20, window_ms: 60_000],
    graphql_mutation: [limit: 120, window_ms: 60_000],
    moderation_action: [limit: 30, window_ms: 60_000],
    channel_join: [limit: 60, window_ms: 60_000],
    chat_send: [limit: 120, window_ms: 60_000]
  ]

  @spec allow(limit_key(), String.t()) :: allow_result()
  def allow(limit_key, subject) when is_atom(limit_key) and is_binary(subject) do
    prune_expired_entries()

    case limit_config(limit_key) do
      [limit: limit, window_ms: window_ms]
      when is_integer(limit) and limit > 0 and is_integer(window_ms) and window_ms > 0 ->
        now_ms = System.system_time(:millisecond)
        bucket_started_at = div(now_ms, window_ms) * window_ms

        # Keep each bucket for one additional window so in-flight requests can
        # still be counted correctly while cleanup remains simple.
        expires_at = bucket_started_at + window_ms * 2

        entry_key = {limit_key, subject, bucket_started_at}
        current_count = increment_counter(entry_key, expires_at)

        if current_count > limit, do: {:error, :rate_limited}, else: :ok

      _other ->
        # Missing/invalid config should fail open rather than locking out users.
        :ok
    end
  end

  @spec conn_subject(Plug.Conn.t()) :: String.t()
  def conn_subject(%Plug.Conn{remote_ip: remote_ip}) do
    case remote_ip do
      {_, _, _, _} = ipv4 -> to_string(:inet.ntoa(ipv4))
      {_, _, _, _, _, _, _, _} = ipv6 -> to_string(:inet.ntoa(ipv6))
      _other -> "unknown"
    end
  end

  @spec reset!() :: :ok
  def reset! do
    _ = ensure_table()
    :ets.delete_all_objects(@table)
    :ok
  end

  @spec increment_counter({limit_key(), String.t(), integer()}, integer()) :: integer()
  defp increment_counter(entry_key, expires_at) do
    _ = ensure_table()
    :ets.update_counter(@table, entry_key, {2, 1}, {entry_key, 0, expires_at})
  end

  @spec prune_expired_entries() :: true
  defp prune_expired_entries do
    _ = ensure_table()
    now_ms = System.system_time(:millisecond)

    :ets.select_delete(@table, [
      {{:"$1", :"$2", :"$3"}, [{:<, :"$3", now_ms}], [true]}
    ])

    true
  end

  @spec ensure_table() :: atom() | :ets.tid()
  defp ensure_table do
    case :ets.whereis(@table) do
      :undefined ->
        try do
          :ets.new(@table, [
            :named_table,
            :set,
            :public,
            read_concurrency: true,
            write_concurrency: true
          ])
        rescue
          ArgumentError -> @table
        end

      tid ->
        tid
    end
  end

  @spec limit_config(limit_key()) :: rate_limit_config()
  defp limit_config(limit_key) do
    Application.get_env(:live_canvas, __MODULE__, [])
    |> Keyword.get(:limits, @default_limits)
    |> Keyword.get(limit_key, [])
  end
end
