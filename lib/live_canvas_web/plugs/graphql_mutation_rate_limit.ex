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
    if graphql_mutation_request?(conn) do
      case RateLimiter.allow(:graphql_mutation, RateLimiter.conn_subject(conn)) do
        :ok ->
          conn

        {:error, :rate_limited} ->
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(:too_many_requests, Jason.encode!(@rate_limit_error_payload))
          |> halt()
      end
    else
      conn
    end
  end

  @spec graphql_mutation_request?(Plug.Conn.t()) :: boolean()
  defp graphql_mutation_request?(%Plug.Conn{
         method: "POST",
         request_path: "/graphql",
         params: params
       }) do
    case Map.get(params, "query") do
      query when is_binary(query) ->
        # We only need a lightweight write-path heuristic here; full GraphQL
        # parsing belongs to Absinthe and would be too expensive at this edge.
        Regex.match?(~r/\bmutation\b/u, query)

      _other ->
        false
    end
  end

  defp graphql_mutation_request?(_conn), do: false
end
