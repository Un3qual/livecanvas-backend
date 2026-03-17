defmodule LC.Accounts.ProviderAuth.JwksCache do
  @moduledoc false

  use GenServer

  @table :lc_provider_auth_jwks_cache

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @spec fetch(String.t(), integer()) :: {:ok, map()} | :miss
  def fetch(url, now) when is_binary(url) and is_integer(now) do
    case :ets.whereis(@table) do
      :undefined ->
        :miss

      table ->
        case :ets.lookup(table, url) do
          [{^url, jwks, expires_at}]
          when is_map(jwks) and is_integer(expires_at) and expires_at > now ->
            {:ok, jwks}

          [{^url, _jwks, expires_at}] when is_integer(expires_at) and expires_at <= now ->
            :ets.delete(table, url)
            :miss

          _other ->
            :miss
        end
    end
  end

  @spec put(String.t(), map(), integer()) :: true | false
  def put(url, jwks, expires_at)
      when is_binary(url) and is_map(jwks) and is_integer(expires_at) do
    case :ets.whereis(@table) do
      :undefined -> false
      table -> :ets.insert(table, {url, jwks, expires_at})
    end
  end

  @spec init(:ok) :: {:ok, nil}
  @impl true
  def init(:ok) do
    # A supervisor-owned ETS table avoids both lazy named-table races and
    # request-owned cache eviction between provider-auth calls.
    _table =
      :ets.new(@table, [
        :named_table,
        :public,
        read_concurrency: true,
        write_concurrency: true
      ])

    {:ok, nil}
  end
end
