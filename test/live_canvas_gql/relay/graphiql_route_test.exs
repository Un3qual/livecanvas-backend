defmodule LCGQL.Relay.GraphiQLRouteTest do
  use LCWeb.ConnCase, async: false

  setup do
    previous_config = Application.get_env(:live_canvas, LCGQL.Router, [])

    on_exit(fn ->
      Application.put_env(:live_canvas, LCGQL.Router, previous_config)
    end)

    :ok
  end

  test "returns 404 when graphiql is disabled", %{conn: conn} do
    Application.put_env(:live_canvas, LCGQL.Router, enable_graphiql: false)

    conn = get(conn, "/graphiql")

    assert conn.status == 404
  end

  test "exposes the graphiql route when graphiql is enabled", %{conn: conn} do
    Application.put_env(:live_canvas, LCGQL.Router, enable_graphiql: true)

    conn = get(conn, "/graphiql")

    refute conn.status == 404
  end
end
