defmodule LCGQL.Router do
  use Plug.Router

  @absinthe_configuration [
    document_providers: {LCGQL, :document_providers},
    # json_codec: Jason,
    schema: LCGQL.Schema
  ]

  plug(:match)
  plug(:dispatch)

  Code.ensure_compiled(LCGQL.Schema)

  forward("/graphql",
    to: Absinthe.Plug,
    init_opts: @absinthe_configuration
    # host: "api."
  )

  # if Application.fetch_env!(:smokespots, :enable_graphiql) do
  forward("/graphiql",
    to: Absinthe.Plug.GraphiQL,
    init_opts: [interface: :simple] ++ @absinthe_configuration
    # host: "api."
  )

  # end
  # end

  match(_, do: conn)
end
