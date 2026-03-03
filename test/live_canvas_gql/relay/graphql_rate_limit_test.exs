defmodule LCGQL.Relay.GraphQLRateLimitTest do
  use LCWeb.ConnCase, async: false

  @rate_limits [
    graphql_mutation: [limit: 1, window_ms: 60_000],
    auth_login: [limit: 10, window_ms: 60_000],
    channel_join: [limit: 10, window_ms: 60_000]
  ]

  setup do
    previous_config = Application.get_env(:live_canvas, LCWeb.RateLimiter, [])

    Application.put_env(:live_canvas, LCWeb.RateLimiter, limits: @rate_limits)
    LCWeb.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LCWeb.RateLimiter, previous_config)
      LCWeb.RateLimiter.reset!()
    end)

    :ok
  end

  test "returns a structured 429 response when mutation limits are exceeded", %{conn: conn} do
    mutation = "mutation { __typename }"
    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    first_conn = post(conn, "/graphql", %{"query" => mutation})
    assert first_conn.status == 200

    second_conn = post(conn, "/graphql", %{"query" => mutation})

    assert second_conn.status == 429

    assert %{
             "errors" => [
               %{"message" => "rate_limited", "extensions" => %{"code" => "RATE_LIMITED"}}
             ]
           } = Jason.decode!(second_conn.resp_body)
  end
end
