defmodule LCGQL.Context do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn, only: [fetch_session: 1, get_req_header: 2, get_session: 2]

  alias LC.Accounts
  alias LCGQL.Dataloader

  @type conn :: Plug.Conn.t()
  @type auth_transport :: :bearer | :session | :none
  @type auth_error :: Accounts.access_token_auth_error() | nil
  @type auth_metadata :: %{transport: auth_transport(), error: auth_error()}
  @type scope_auth_result :: {Accounts.Scope.t() | nil, auth_metadata()}

  @impl Plug
  @spec init(term()) :: term()
  def init(opts), do: opts

  @impl Plug
  @spec call(conn(), term()) :: conn()
  def call(conn, _opts) do
    conn = fetch_session(conn)
    {scope, auth_metadata} = scope_from_request(conn)

    loader =
      Dataloader.new(%{
        current_scope: scope,
        auth_transport: auth_metadata.transport,
        auth_error: auth_metadata.error
      })

    Absinthe.Plug.put_options(conn,
      context: %{
        current_scope: scope,
        auth_transport: auth_metadata.transport,
        auth_error: auth_metadata.error,
        loader: loader
      }
    )
  end

  # Bearer auth is authoritative when present so mobile/API clients can rely on
  # explicit token transport semantics without accidental session fallback.
  @spec scope_from_request(conn()) :: scope_auth_result()
  defp scope_from_request(conn) do
    case bearer_token_from_authorization_header(conn) do
      {:ok, bearer_token} ->
        scope_from_access_token(bearer_token)

      :missing ->
        conn
        |> get_session(:user_token)
        |> scope_from_session_token()

      :malformed ->
        {Accounts.empty_scope(), %{transport: :bearer, error: :invalid_token}}
    end
  end

  @spec scope_from_access_token(String.t()) :: scope_auth_result()
  defp scope_from_access_token(token) do
    case Accounts.authenticate_access_token(token) do
      {:ok, scope} -> {scope, %{transport: :bearer, error: nil}}
      {:error, reason} -> {Accounts.empty_scope(), %{transport: :bearer, error: reason}}
    end
  end

  @spec scope_from_session_token(String.t() | nil) :: scope_auth_result()
  defp scope_from_session_token(nil),
    do: {Accounts.empty_scope(), %{transport: :none, error: nil}}

  defp scope_from_session_token(token) do
    case Accounts.get_user_by_session_token(token) do
      {user, _inserted_at} ->
        {Accounts.scope_for_user(user), %{transport: :session, error: nil}}

      nil ->
        {Accounts.empty_scope(), %{transport: :session, error: nil}}
    end
  end

  @spec bearer_token_from_authorization_header(conn()) ::
          {:ok, String.t()} | :missing | :malformed
  defp bearer_token_from_authorization_header(conn) do
    case get_req_header(conn, "authorization") do
      [] -> :missing
      [authorization | _rest] -> parse_bearer_authorization(authorization)
    end
  end

  @spec parse_bearer_authorization(String.t()) :: {:ok, String.t()} | :malformed
  defp parse_bearer_authorization(authorization) when is_binary(authorization) do
    case Regex.run(~r/^\s*bearer\s+(.+)\s*$/i, authorization, capture: :all_but_first) do
      [token] ->
        normalized = String.trim(token)

        if normalized == "" do
          :malformed
        else
          {:ok, normalized}
        end

      _ ->
        :malformed
    end
  end
end
