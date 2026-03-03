defmodule LCWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common data structures and query the data layer.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use LCWeb.ConnCase, async: true`, although
  this option is not recommended for other databases.
  """

  use ExUnit.CaseTemplate

  alias LC.Accounts

  using do
    quote do
      # The default endpoint for testing
      @endpoint LCWeb.Endpoint

      use LCWeb, :verified_routes

      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import LCWeb.ConnCase
    end
  end

  setup tags do
    LC.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end

  @doc """
  Setup helper that registers and logs in users.

      setup :register_and_log_in_user

  It stores an updated connection and a registered user in the
  test context.
  """
  def register_and_log_in_user(%{conn: conn} = context) do
    user = LC.AccountsFixtures.user_fixture()
    scope = LC.Accounts.scope_for_user(user)

    opts =
      context
      |> Map.take([:token_authenticated_at])
      |> Enum.into([])

    %{conn: log_in_user(conn, user, opts), user: user, scope: scope}
  end

  @doc """
  Logs the given `user` into the `conn`.

  It returns an updated `conn`.
  """
  def log_in_user(conn, user, opts \\ []) do
    token = LC.Accounts.generate_user_session_token(user)

    maybe_set_token_authenticated_at(token, opts[:token_authenticated_at])

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end

  @doc """
  Loads the authenticated scope for the current `conn` session token.
  """
  def authenticated_scope_from_conn(conn) do
    with token when is_binary(token) <- Plug.Conn.get_session(conn, :user_token),
         {%{id: user_id} = user, _inserted_at} when is_integer(user_id) <-
           Accounts.get_user_by_session_token(token) do
      Accounts.scope_for_user(user)
    else
      _ -> raise "expected conn with a valid :user_token session"
    end
  end

  @doc """
  Authenticates a channel socket with a session token for the given user.
  """
  def authenticated_socket(%Phoenix.Socket{} = socket, %{id: user_id} = user)
      when is_integer(user_id) do
    token = Accounts.generate_user_session_token(user)

    case LCWeb.UserSocket.connect(%{"token" => token}, socket, %{}) do
      {:ok, authenticated_socket} ->
        authenticated_socket

      :error ->
        raise "expected socket authentication to succeed for user #{user_id}"
    end
  end

  defp maybe_set_token_authenticated_at(_token, nil), do: nil

  defp maybe_set_token_authenticated_at(token, authenticated_at) do
    LC.AccountsFixtures.override_token_authenticated_at(token, authenticated_at)
  end
end
