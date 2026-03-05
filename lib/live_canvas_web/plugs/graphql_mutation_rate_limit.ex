defmodule LCWeb.Plugs.GraphQLMutationRateLimit do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn

  alias LCWeb.RateLimiter

  @rate_limit_error_payload %{
    errors: [
      %{
        message: "rate_limited",
        extensions: %{code: "RATE_LIMITED"}
      }
    ]
  }

  @impl Plug
  @spec init(term()) :: term()
  def init(opts), do: opts

  @impl Plug
  @spec call(Plug.Conn.t(), term()) :: Plug.Conn.t()
  def call(conn, _opts) do
    case mutation_query(conn) do
      {:ok, query} ->
        case RateLimiter.allow(rate_limit_key(query), RateLimiter.conn_subject(conn)) do
          :ok ->
            conn

          {:error, :rate_limited} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(:too_many_requests, Jason.encode!(@rate_limit_error_payload))
            |> halt()
        end

      :error ->
        conn
    end
  end

  @spec mutation_query(Plug.Conn.t()) :: {:ok, String.t()} | :error
  defp mutation_query(%Plug.Conn{
         method: "POST",
         request_path: "/graphql",
         params: params
       }) do
    case Map.get(params, "query") do
      query when is_binary(query) ->
        # We only need a lightweight write-path heuristic here; full GraphQL
        # parsing belongs to Absinthe and would be too expensive at this edge.
        if Regex.match?(~r/\bmutation\b/u, query), do: {:ok, query}, else: :error

      _other ->
        :error
    end
  end

  defp mutation_query(_conn), do: :error

  @spec rate_limit_key(String.t()) :: :graphql_mutation | :moderation_action
  defp rate_limit_key(query) when is_binary(query) do
    if moderation_mutation?(query), do: :moderation_action, else: :graphql_mutation
  end

  @spec moderation_mutation?(String.t()) :: boolean()
  defp moderation_mutation?(query) when is_binary(query) do
    # Moderation writes can be high-impact/abusive and need tighter controls
    # than generic mutation traffic.
    Regex.match?(~r/\b(blockUser|unblockUser|muteUser|unmuteUser)\b/u, query)
  end
end
