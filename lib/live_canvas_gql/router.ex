defmodule LCGQL.Router do
  use Plug.Router

  @type router_config :: [enable_graphiql: boolean()]

  @absinthe_configuration [
    document_providers: {LCGQL, :document_providers},
    # json_codec: Jason,
    schema: LCGQL.Schema
  ]

  plug(:match)
  plug(LCGQL.Context)
  plug(:dispatch)

  Code.ensure_compiled(LCGQL.Schema)

  forward("/graphql",
    to: Absinthe.Plug,
    init_opts: @absinthe_configuration
    # host: "api."
  )

  match("/graphiql") do
    if graphiql_enabled?() do
      Absinthe.Plug.GraphiQL.call(
        conn,
        Absinthe.Plug.GraphiQL.init([interface: :simple] ++ @absinthe_configuration)
      )
    else
      Plug.Conn.send_resp(conn, 404, "Not Found")
    end
  end

  match(_, do: conn)

  @spec graphiql_enabled?() :: boolean()
  defp graphiql_enabled? do
    Application.get_env(:live_canvas, __MODULE__, [])
    |> Keyword.get(:enable_graphiql, false)
  end
end
