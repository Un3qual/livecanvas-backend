defmodule LCWeb.UserResetPasswordController do
  use LCWeb, :controller

  alias LC.Accounts

  @type conn :: Plug.Conn.t()

  @spec new(conn(), map()) :: conn()
  def new(conn, _params) do
    form = Phoenix.Component.to_form(%{}, as: "user")
    render(conn, :new, form: form)
  end

  @spec create(conn(), map()) :: conn()
  def create(conn, %{"user" => %{"email" => email}}) do
    case Accounts.get_user_by_email(email) do
      nil ->
        :ok

      user ->
        case Accounts.deliver_user_reset_password_instructions(
               user,
               &url(~p"/users/reset-password/#{&1}")
             ) do
          {:ok, _email} -> :ok
          _ -> :ok
        end
    end

    conn
    |> put_flash(
      :info,
      "If your email is in our system, you will receive instructions to reset your password shortly."
    )
    |> redirect(to: ~p"/users/log-in")
  end

  @spec edit(conn(), map()) :: conn()
  def edit(conn, %{"token" => token}) do
    if Accounts.get_user_by_password_reset_token(token) do
      form = Phoenix.Component.to_form(%{}, as: "user")
      render(conn, :edit, token: token, form: form)
    else
      conn
      |> put_flash(:error, "Reset password link is invalid or it has expired.")
      |> redirect(to: ~p"/users/reset-password")
    end
  end

  @spec update(conn(), map()) :: conn()
  def update(conn, %{"token" => token, "user" => user_params}) do
    case Accounts.reset_user_password(token, user_params) do
      {:ok, {_user, _expired_tokens}} ->
        conn
        |> put_flash(:info, "Password reset successfully.")
        |> redirect(to: ~p"/users/log-in")

      {:error, :not_found} ->
        conn
        |> put_flash(:error, "Reset password link is invalid or it has expired.")
        |> redirect(to: ~p"/users/reset-password")

      {:error, %Ecto.Changeset{} = changeset} ->
        # Keep the submitted token in the form action while surfacing password validation errors.
        form = Phoenix.Component.to_form(%{changeset | action: :update}, as: "user")
        render(conn, :edit, token: token, form: form)
    end
  end
end
