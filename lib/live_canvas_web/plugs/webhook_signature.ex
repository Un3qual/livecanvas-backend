defmodule LCWeb.Plugs.WebhookSignature do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn

  alias Plug.Crypto

  @signature_header "x-livecanvas-signature"
  @timestamp_header "x-livecanvas-timestamp"

  @impl Plug
  @spec init(keyword()) :: keyword()
  def init(opts), do: opts

  @impl Plug
  @spec call(Plug.Conn.t(), keyword()) :: Plug.Conn.t()
  def call(conn, opts) do
    provider = Keyword.fetch!(opts, :provider)
    config = config()
    max_skew_seconds = Keyword.get(config, :max_skew_seconds, 300)

    with secret when is_binary(secret) <- Keyword.get(config[:providers] || [], provider),
         {:ok, signature} <- fetch_required_header(conn, @signature_header),
         {:ok, timestamp} <- parse_timestamp(conn),
         :ok <- validate_timestamp(timestamp, max_skew_seconds),
         {:ok, raw_body} <- fetch_raw_body(conn),
         :ok <- verify_signature(secret, signature, timestamp, raw_body) do
      conn
    else
      _reason ->
        conn
        |> send_resp(:unauthorized, "invalid_signature")
        |> halt()
    end
  end

  @spec fetch_required_header(Plug.Conn.t(), String.t()) :: {:ok, String.t()} | {:error, atom()}
  defp fetch_required_header(conn, header_name) do
    case get_req_header(conn, header_name) do
      [value] when is_binary(value) and byte_size(value) > 0 -> {:ok, String.trim(value)}
      _ -> {:error, :missing_header}
    end
  end

  @spec parse_timestamp(Plug.Conn.t()) :: {:ok, integer()} | {:error, atom()}
  defp parse_timestamp(conn) do
    with {:ok, timestamp_value} <- fetch_required_header(conn, @timestamp_header),
         {timestamp, ""} when timestamp > 0 <- Integer.parse(timestamp_value) do
      {:ok, timestamp}
    else
      _ -> {:error, :invalid_timestamp}
    end
  end

  defp validate_timestamp(timestamp, max_skew_seconds)
       when is_integer(timestamp) and is_integer(max_skew_seconds) and max_skew_seconds > 0 do
    now = System.system_time(:second)

    if abs(now - timestamp) <= max_skew_seconds do
      :ok
    else
      {:error, :stale_timestamp}
    end
  end

  @spec fetch_raw_body(Plug.Conn.t()) :: {:ok, binary()} | {:error, atom()}
  defp fetch_raw_body(conn) do
    case conn.assigns[:raw_body] do
      raw_body when is_binary(raw_body) and byte_size(raw_body) > 0 -> {:ok, raw_body}
      _ -> {:error, :missing_raw_body}
    end
  end

  defp verify_signature(secret, signature, timestamp, raw_body)
       when is_binary(secret) and is_binary(signature) and is_integer(timestamp) and
              is_binary(raw_body) do
    expected_signature = signature(secret, timestamp, raw_body)

    normalized_signature =
      signature
      |> String.trim()
      |> String.trim_leading("sha256=")
      |> String.downcase()

    if byte_size(normalized_signature) == byte_size(expected_signature) and
         Crypto.secure_compare(normalized_signature, expected_signature) do
      :ok
    else
      {:error, :invalid_signature}
    end
  end

  defp signature(secret, timestamp, raw_body) do
    :crypto.mac(:hmac, :sha256, secret, "#{timestamp}.#{raw_body}")
    |> Base.encode16(case: :lower)
  end

  @spec config() :: keyword()
  defp config do
    Application.get_env(:live_canvas, __MODULE__, [])
  end
end
