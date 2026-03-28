defmodule LCWeb.UserSocket do
  use Phoenix.Socket

  require Logger

  alias LC.Accounts
  alias LCWeb.Plugs.ObservabilityContext

  channel "live_session:*", LCWeb.LiveSessionChannel

  @impl true
  @spec connect(map(), Phoenix.Socket.t(), map()) :: {:ok, Phoenix.Socket.t()} | :error
  def connect(%{"token" => token} = params, socket, _connect_info) when is_binary(token) do
    case Accounts.get_user_by_session_token(token) do
      {%{id: user_id} = user, _inserted_at} when is_integer(user_id) ->
        observability_context =
          params
          |> ObservabilityContext.build_socket_context(user_id)
          |> ObservabilityContext.put_viewer_context(user_id)

        Logger.metadata(ObservabilityContext.logger_metadata(observability_context))

        {:ok,
         socket
         |> assign(:current_user, user)
         |> assign(:observability_context, observability_context)}

      _ ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  @spec id(Phoenix.Socket.t()) :: String.t() | nil
  def id(%Phoenix.Socket{assigns: %{current_user: %{id: user_id}}}) when is_integer(user_id),
    do: "users_socket:#{user_id}"

  def id(_socket), do: nil
end
