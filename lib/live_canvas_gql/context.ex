defmodule LCGQL.Context do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn, only: [fetch_session: 1, get_session: 2]

  alias LC.Accounts

  @type conn :: Plug.Conn.t()

  @impl Plug
  @spec init(term()) :: term()
  def init(opts), do: opts

  @impl Plug
  @spec call(conn(), term()) :: conn()
  def call(conn, _opts) do
    conn = fetch_session(conn)

    scope =
      conn
      |> get_session(:user_token)
      |> scope_from_session_token()

    Absinthe.Plug.put_options(conn, context: %{current_scope: scope})
  end

  @spec scope_from_session_token(String.t() | nil) :: LC.Accounts.Scope.t() | nil
  defp scope_from_session_token(nil), do: Accounts.empty_scope()

  defp scope_from_session_token(token) do
    case Accounts.get_user_by_session_token(token) do
      {user, _inserted_at} -> Accounts.scope_for_user(user)
      nil -> Accounts.empty_scope()
    end
  end
end
