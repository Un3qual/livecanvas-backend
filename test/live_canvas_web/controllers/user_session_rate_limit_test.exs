defmodule LCWeb.UserSessionRateLimitTest do
  use LCWeb.ConnCase, async: false

  @rate_limits [
    graphql_mutation: [limit: 10, window_ms: 60_000],
    auth_login: [limit: 1, window_ms: 60_000],
    channel_join: [limit: 10, window_ms: 60_000]
  ]

  setup do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(:live_canvas, LC.RateLimiter, limits: @rate_limits)
    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    :ok
  end

  test "returns 429 when login request rate limit is exceeded", %{conn: conn} do
    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    first_conn =
      post(conn, ~p"/users/log-in", %{
        "user" => %{"email" => "missing@example.com"}
      })

    assert first_conn.status == 302

    second_conn =
      post(conn, ~p"/users/log-in", %{
        "user" => %{"email" => "missing@example.com"}
      })

    assert second_conn.status == 429
    assert second_conn.resp_body =~ "rate_limited"
  end
end
