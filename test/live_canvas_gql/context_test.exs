defmodule LCGQL.ContextTest do
  use LCWeb.ConnCase, async: true

  import LC.AccountsFixtures

  alias LC.Accounts

  @request_id "graphql-request-id-1234567890"
  @trace_id String.duplicate("b", 32)

  test "passes observability context into Absinthe without leaking bearer tokens", %{conn: conn} do
    user = user_fixture()
    {:ok, %{token: token}} = Accounts.issue_access_token(user)

    conn =
      conn
      |> put_req_header("x-request-id", @request_id)
      |> put_req_header("x-trace-id", @trace_id)
      |> put_req_header("authorization", "Bearer #{token}")
      |> post("/graphql", %{query: viewer_email_query()})

    assert %{"data" => %{"viewer" => %{"email" => user_email}}} = json_response(conn, 200)
    assert user_email == user.email

    assert get_in(conn.private, [:absinthe, :context, :observability_context]) == %{
             request_id: @request_id,
             trace_id: @trace_id,
             viewer_id: user.id,
             live_session_id: nil
           }

    refute inspect(get_in(conn.private, [:absinthe, :context, :observability_context])) =~ token
    assert get_resp_header(conn, "x-trace-id") == [@trace_id]
  end

  defp viewer_email_query do
    """
    query {
      viewer {
        email
      }
    }
    """
  end
end
