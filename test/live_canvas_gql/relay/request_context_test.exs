defmodule LCGQL.Relay.RequestContextTest do
  use LCWeb.ConnCase, async: true

  import LC.AccountsFixtures

  alias LC.Accounts

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

    test "resolves from a bearer access token without a session", %{conn: conn} do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_access_token(user)

      query = """
      query {
        viewer {
          email
        }
      }
      """

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{token}")
        |> post("/graphql", %{query: query})

      assert %{"data" => %{"viewer" => %{"email" => user_email}}} = json_response(conn, 200)
      assert user_email == user.email
    end

    test "prefers bearer access token over a logged-in session token", %{conn: conn} do
      session_user = user_fixture()
      bearer_user = user_fixture()
      {:ok, %{token: bearer_token}} = Accounts.issue_access_token(bearer_user)

      query = """
      query {
        viewer {
          email
        }
      }
      """

      conn =
        conn
        |> log_in_user(session_user)
        |> put_req_header("authorization", "Bearer #{bearer_token}")
        |> post("/graphql", %{query: query})

      assert %{"data" => %{"viewer" => %{"email" => user_email}}} = json_response(conn, 200)
      assert user_email == bearer_user.email
    end

    test "does not fall back to session auth when bearer token is invalid", %{conn: conn} do
      session_user = user_fixture()

      query = """
      query {
        viewer {
          email
        }
      }
      """

      conn =
        conn
        |> log_in_user(session_user)
        |> put_req_header("authorization", "Bearer not-a-token")
        |> post("/graphql", %{query: query})

      assert %{"data" => %{"viewer" => nil}} = json_response(conn, 200)
    end
  end
end
