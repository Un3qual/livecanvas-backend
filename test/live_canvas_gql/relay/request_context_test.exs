defmodule LCGQL.Relay.RequestContextTest do
  use LCWeb.ConnCase, async: true

  import LC.AccountsFixtures

  describe "viewer" do
    test "resolves from the logged-in session when userId is omitted", %{conn: conn} do
      user = user_fixture()

      query = """
      query {
        viewer {
          email
        }
      }
      """

      conn =
        conn
        |> log_in_user(user)
        |> post("/graphql", %{query: query})

      assert %{"data" => %{"viewer" => %{"email" => user_email}}} = json_response(conn, 200)
      assert user_email == user.email
    end
  end
end
