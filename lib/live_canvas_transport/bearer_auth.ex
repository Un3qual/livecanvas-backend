defmodule LCTransport.BearerAuth do
  @moduledoc """
  Parses HTTP Authorization Bearer tokens for request-facing transports.
  """

  import Plug.Conn, only: [get_req_header: 2]

  @type token_result :: {:ok, String.t()} | :missing | :malformed
  @type parse_result :: {:ok, String.t()} | :malformed

  @spec token_from_conn(Plug.Conn.t()) :: token_result()
  def token_from_conn(conn) do
    case get_req_header(conn, "authorization") do
      [] -> :missing
      [authorization | _rest] -> parse_authorization(authorization)
    end
  end

  @spec parse_authorization(term()) :: parse_result()
  def parse_authorization(authorization) when is_binary(authorization) do
    case Regex.run(~r/^\s*bearer\s+(.+)\s*$/i, authorization, capture: :all_but_first) do
      [token] ->
        token
        |> String.trim()
        |> non_empty_token()

      _other ->
        :malformed
    end
  end

  def parse_authorization(_authorization), do: :malformed

  @spec non_empty_token(String.t()) :: {:ok, String.t()} | :malformed
  defp non_empty_token(""), do: :malformed
  defp non_empty_token(token), do: {:ok, token}
end
