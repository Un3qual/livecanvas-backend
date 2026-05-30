defmodule LCWeb.Plugs.MetricsAuth do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn

  alias LCTransport.BearerAuth
  alias Plug.Crypto

  @metrics_content_type "text/plain; version=0.0.4; charset=utf-8"

  @impl Plug
  @spec init(keyword()) :: keyword()
  def init(opts), do: opts

  @impl Plug
  @spec call(Plug.Conn.t(), keyword()) :: Plug.Conn.t()
  def call(conn, _opts) do
    config = config()

    if Keyword.get(config, :enabled, false) do
      authorize_and_scrape(conn, config)
    else
      not_found(conn)
    end
  end

  # A bearer header keeps rollout secrets out of query strings and the default
  # Phoenix request logs while still giving operators a simple scrape contract.
  @spec authorize_and_scrape(Plug.Conn.t(), keyword()) :: Plug.Conn.t()
  defp authorize_and_scrape(conn, config) when is_list(config) do
    with {:ok, configured_token} <- configured_token(config),
         {:ok, provided_token} <- BearerAuth.token_from_conn(conn),
         :ok <- verify_token(configured_token, provided_token) do
      scrape_body =
        config
        |> reporter_name()
        |> TelemetryMetricsPrometheus.Core.scrape()

      conn
      |> put_resp_header("cache-control", "no-store, max-age=0")
      |> put_resp_header("content-type", @metrics_content_type)
      |> send_resp(:ok, scrape_body)
      |> halt()
    else
      _reason ->
        unauthorized(conn)
    end
  end

  @spec configured_token(keyword()) :: {:ok, String.t()} | {:error, :missing_token}
  defp configured_token(config) when is_list(config) do
    case Keyword.get(config, :token) do
      token when is_binary(token) ->
        normalized = String.trim(token)

        if normalized == "" do
          {:error, :missing_token}
        else
          {:ok, normalized}
        end

      _other ->
        {:error, :missing_token}
    end
  end

  @spec verify_token(String.t(), String.t()) :: :ok | :error
  defp verify_token(configured_token, provided_token)
       when is_binary(configured_token) and is_binary(provided_token) do
    if byte_size(configured_token) == byte_size(provided_token) and
         Crypto.secure_compare(configured_token, provided_token) do
      :ok
    else
      :error
    end
  end

  @spec reporter_name(keyword()) :: atom()
  defp reporter_name(config) when is_list(config) do
    Keyword.get(config, :reporter_name, :live_canvas_prometheus_metrics)
  end

  @spec unauthorized(Plug.Conn.t()) :: Plug.Conn.t()
  defp unauthorized(conn) do
    conn
    |> send_resp(:unauthorized, "invalid_metrics_token")
    |> halt()
  end

  @spec not_found(Plug.Conn.t()) :: Plug.Conn.t()
  defp not_found(conn) do
    conn
    |> send_resp(:not_found, "not_found")
    |> halt()
  end

  @spec config() :: keyword()
  defp config do
    Application.get_env(:live_canvas, __MODULE__, [])
  end
end
