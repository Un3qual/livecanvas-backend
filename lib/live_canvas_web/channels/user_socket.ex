defmodule LCWeb.UserSocket do
  use Phoenix.Socket

  alias LC.Accounts

  channel "live_session:*", LCWeb.LiveSessionChannel

  @impl true
  @spec connect(map(), Phoenix.Socket.t(), map()) :: {:ok, Phoenix.Socket.t()} | :error
  def connect(%{"token" => token}, socket, _connect_info) when is_binary(token) do
    case Accounts.get_user_by_session_token(token) do
      {%{id: user_id} = user, _inserted_at} when is_integer(user_id) ->
        {:ok, assign(socket, :current_user, user)}

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
