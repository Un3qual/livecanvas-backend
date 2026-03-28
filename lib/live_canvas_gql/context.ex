defmodule LCGQL.Context do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn, only: [assign: 3, fetch_session: 1, get_req_header: 2, get_session: 2]

  require Logger

  alias LC.Accounts
  alias LCGQL.Dataloader

  @type conn :: Plug.Conn.t()
  @type auth_transport :: :bearer | :session | :none
  @type auth_error :: Accounts.access_token_auth_error() | nil
  @type observability_context :: %{
          request_id: String.t(),
          trace_id: String.t(),
          viewer_id: pos_integer() | nil,
          live_session_id: pos_integer() | nil
        }
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
    observability_context = observability_context(conn, scope)

    loader =
      Dataloader.new(%{
        current_scope: scope,
        auth_transport: auth_metadata.transport,
        auth_error: auth_metadata.error,
        observability_context: observability_context
      })

    Logger.metadata(observability_logger_metadata(observability_context))

    conn
    |> assign(:observability_context, observability_context)
    |> Absinthe.Plug.put_options(
      context: %{
        current_scope: scope,
        auth_transport: auth_metadata.transport,
        auth_error: auth_metadata.error,
        observability_context: observability_context,
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

  @spec observability_context(conn(), Accounts.Scope.t() | nil) :: observability_context()
  defp observability_context(conn, scope) do
    conn.assigns
    |> Map.get(:observability_context, base_observability_context(conn))
    |> Map.put(:viewer_id, viewer_id_from_scope(scope))
  end

  @spec base_observability_context(conn()) :: observability_context()
  defp base_observability_context(conn) do
    %{
      request_id: conn.assigns[:request_id],
      trace_id: List.first(Plug.Conn.get_resp_header(conn, "x-trace-id")),
      viewer_id: nil,
      live_session_id: nil
    }
  end

  @spec viewer_id_from_scope(Accounts.Scope.t() | nil) :: pos_integer() | nil
  defp viewer_id_from_scope(%{user: %{id: user_id}}) when is_integer(user_id), do: user_id

  defp viewer_id_from_scope(_scope), do: nil

  @spec observability_logger_metadata(observability_context()) :: keyword()
  defp observability_logger_metadata(observability_context) when is_map(observability_context) do
    observability_context
    |> Map.take([:request_id, :trace_id, :viewer_id, :live_session_id])
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
  end
end
