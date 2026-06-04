defmodule LC.RateLimiter do
  @moduledoc false

  @type limit_key ::
          :auth_login
          | :graphql_mutation
          | :moderation_action
          | :channel_join
          | :chat_send
          | :media_signal
  @type allow_result :: :ok | {:error, :rate_limited}
  @type rate_limit_config :: [limit: pos_integer(), window_ms: pos_integer()]

  @table __MODULE__
  @default_limits [
    auth_login: [limit: 20, window_ms: 60_000],
    graphql_mutation: [limit: 120, window_ms: 60_000],
    moderation_action: [limit: 30, window_ms: 60_000],
    channel_join: [limit: 60, window_ms: 60_000],
    chat_send: [limit: 120, window_ms: 60_000],
    media_signal: [limit: 600, window_ms: 60_000]
  ]
  @default_env [
    erpc_module: :erpc,
    erpc_timeout: 5_000
  ]

  @spec allow(limit_key(), String.t()) :: allow_result()
  def allow(limit_key, subject) when is_atom(limit_key) and is_binary(subject) do
    now_ms = System.system_time(:millisecond)

    case limit_config(limit_key) do
      [limit: limit, window_ms: window_ms]
      when is_integer(limit) and limit > 0 and is_integer(window_ms) and window_ms > 0 ->
        owner = owner_node(limit_key, subject)

        if owner == Node.self() do
          do_allow(limit_key, subject, now_ms, limit, window_ms)
        else
          remote_allow(owner, limit_key, subject, now_ms, limit, window_ms)
        end

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

  @doc false
  @spec allow_owner(limit_key(), String.t(), integer(), pos_integer(), pos_integer()) ::
          allow_result()
  def allow_owner(limit_key, subject, now_ms, limit, window_ms) do
    do_allow(limit_key, subject, now_ms, limit, window_ms)
  end

  @doc false
  @spec owner_node(limit_key(), String.t()) :: node()
  def owner_node(limit_key, subject) when is_atom(limit_key) and is_binary(subject) do
    # All nodes hash over the same sorted membership list so each subject lands
    # on one authoritative owner in healthy cluster conditions.
    nodes = sort_nodes(cluster_nodes())

    case nodes do
      [] -> Node.self()
      sorted -> Enum.at(sorted, :erlang.phash2({limit_key, subject}, length(sorted)))
    end
  end

  @spec increment_counter({limit_key(), String.t(), integer()}, integer()) :: integer()
  defp increment_counter(entry_key, expires_at) do
    _ = ensure_table()
    :ets.update_counter(@table, entry_key, {2, 1}, {entry_key, 0, expires_at})
  end

  defp do_allow(limit_key, subject, now_ms, limit, window_ms) do
    prune_expired_entries()
    bucket_started_at = div(now_ms, window_ms) * window_ms

    # Keep each bucket for one additional window so in-flight requests can
    # still be counted correctly while cleanup remains simple.
    expires_at = bucket_started_at + window_ms * 2

    entry_key = {limit_key, subject, bucket_started_at}
    current_count = increment_counter(entry_key, expires_at)

    if current_count > limit, do: {:error, :rate_limited}, else: :ok
  end

  defp remote_allow(owner, limit_key, subject, now_ms, limit, window_ms) do
    case safe_erpc_call(owner, __MODULE__, :allow_owner, [
           limit_key,
           subject,
           now_ms,
           limit,
           window_ms
         ]) do
      {:ok, result} -> result
      {:error, _reason} -> do_allow(limit_key, subject, now_ms, limit, window_ms)
    end
  end

  defp cluster_nodes do
    case Keyword.get(rate_limiter_env(), :cluster_nodes) do
      nil -> [Node.self() | Node.list()]
      [] -> [Node.self()]
      nodes -> nodes
    end
  end

  defp sort_nodes(nodes) do
    nodes
    |> Enum.uniq()
    |> Enum.sort_by(&Atom.to_string/1)
  end

  defp rate_limiter_env do
    Keyword.merge(@default_env, Application.get_env(:live_canvas, __MODULE__, []))
  end

  defp safe_erpc_call(owner, module, fun, args) do
    timeout = Keyword.get(rate_limiter_env(), :erpc_timeout, 5_000)
    erpc = Keyword.get(rate_limiter_env(), :erpc_module, :erpc)

    try do
      case erpc.call(owner, module, fun, args, timeout) do
        {:badrpc, _} = reason -> {:error, reason}
        result -> {:ok, result}
      end
    catch
      :exit, reason -> {:error, reason}
      :error, reason -> {:error, reason}
      :throw, reason -> {:error, reason}
    end
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
