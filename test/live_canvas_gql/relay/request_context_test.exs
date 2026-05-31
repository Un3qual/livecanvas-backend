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

    test "does not fall back to session auth when authorization header is malformed", %{
      conn: conn
    } do
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
        |> put_req_header("authorization", "Basic not-bearer")
        |> post("/graphql", %{query: query})

      assert %{"data" => %{"viewer" => nil}} = json_response(conn, 200)
    end
  end

  describe "request loader context" do
    test "assigns a fresh dataloader to each GraphQL request", %{conn: conn} do
      user = user_fixture()

      first_conn =
        conn
        |> log_in_user(user)
        |> post("/graphql", %{query: viewer_email_query()})

      second_conn =
        Phoenix.ConnTest.build_conn()
        |> log_in_user(user)
        |> post("/graphql", %{query: viewer_email_query()})

      first_loader = graphql_loader(first_conn)
      second_loader = graphql_loader(second_conn)

      assert %Dataloader{} = first_loader
      assert %Dataloader{} = second_loader

      refute loader_request_ref(first_loader) == loader_request_ref(second_loader)
    end

    test "keeps auth scope and auth metadata alongside the loader", %{conn: conn} do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_access_token(user)

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{token}")
        |> post("/graphql", %{query: viewer_email_query()})

      assert %Dataloader{} = graphql_loader(conn)
      assert conn.private.absinthe.context.current_scope.user.id == user.id
      assert get_in(conn.private, [:absinthe, :context, :auth_transport]) == :bearer
      assert get_in(conn.private, [:absinthe, :context, :auth_error]) == nil
    end
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

  defp graphql_loader(conn) do
    get_in(conn.private, [:absinthe, :context, :loader])
  end

  defp loader_request_ref(%Dataloader{sources: sources}) do
    sources
    |> Map.fetch!(Accounts)
    |> Map.fetch!(:default_params)
    |> Map.fetch!(:request_ref)
  end
end
