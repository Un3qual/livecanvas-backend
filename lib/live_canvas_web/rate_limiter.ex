defmodule LCWeb.RateLimiter do
  @moduledoc false

  @type limit_key :: LC.RateLimiter.limit_key()
  @type allow_result :: LC.RateLimiter.allow_result()
  @type rate_limit_config :: LC.RateLimiter.rate_limit_config()

  @spec allow(limit_key(), String.t()) :: allow_result()
  defdelegate allow(limit_key, subject), to: LC.RateLimiter

  @spec conn_subject(Plug.Conn.t()) :: String.t()
  defdelegate conn_subject(conn), to: LC.RateLimiter

  @spec reset!() :: :ok
  defdelegate reset!(), to: LC.RateLimiter
end
