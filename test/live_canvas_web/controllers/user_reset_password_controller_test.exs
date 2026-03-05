defmodule LCWeb.UserResetPasswordControllerTest do
  use LCWeb.ConnCase, async: true

  import LC.AccountsFixtures
  alias LC.Accounts

  setup do
    user = user_fixture() |> set_password()
    %{user: user}
  end

  describe "GET /users/reset-password" do
    test "renders reset password page", %{conn: conn} do
      conn = get(conn, ~p"/users/reset-password")
      response = html_response(conn, 200)
      assert response =~ "Forgot your password?"
      assert response =~ ~p"/users/log-in"
      assert response =~ ~p"/users/reset-password"
    end

    test "redirects if already logged in", %{conn: conn, user: user} do
      conn = conn |> log_in_user(user) |> get(~p"/users/reset-password")

      assert redirected_to(conn) == ~p"/"
    end
  end

  describe "POST /users/reset-password" do
    test "sends reset password token when email exists", %{conn: conn, user: user} do
      conn =
        post(conn, ~p"/users/reset-password", %{
          "user" => %{"email" => user.email}
        })

      assert redirected_to(conn) == ~p"/users/log-in"

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~
               "If your email is in our system, you will receive instructions to reset your password shortly."
    end

    test "does not disclose if user does not exist", %{conn: conn} do
      conn =
        post(conn, ~p"/users/reset-password", %{
          "user" => %{"email" => "unknown@example.com"}
        })

      assert redirected_to(conn) == ~p"/users/log-in"

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~
               "If your email is in our system, you will receive instructions to reset your password shortly."
    end
  end

  describe "GET /users/reset-password/:token" do
    test "renders reset password page for a valid token", %{conn: conn, user: user} do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_reset_password_instructions(user, url)
        end)

      conn = get(conn, ~p"/users/reset-password/#{token}")

      response = html_response(conn, 200)
      assert response =~ "Reset password"
      assert response =~ ~p"/users/reset-password/#{token}"
    end

    test "redirects when token is invalid", %{conn: conn} do
      conn = get(conn, ~p"/users/reset-password/invalid-token")

      assert redirected_to(conn) == ~p"/users/reset-password"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "Reset password link is invalid or it has expired."
    end
  end

  describe "PUT /users/reset-password/:token" do
    test "resets password once", %{conn: conn, user: user} do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_reset_password_instructions(user, url)
        end)

      conn =
        put(conn, ~p"/users/reset-password/#{token}", %{
          "user" => %{
            "password" => "new valid password",
            "password_confirmation" => "new valid password"
          }
        })

      assert redirected_to(conn) == ~p"/users/log-in"
      assert Phoenix.Flash.get(conn.assigns.flash, :info) == "Password reset successfully."
      assert Accounts.get_user_by_email_and_password(user.email, "new valid password")

      conn =
        put(recycle(conn), ~p"/users/reset-password/#{token}", %{
          "user" => %{
            "password" => "new valid password",
            "password_confirmation" => "new valid password"
          }
        })

      assert redirected_to(conn) == ~p"/users/reset-password"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "Reset password link is invalid or it has expired."
    end

    test "does not reset password on invalid data", %{conn: conn, user: user} do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_reset_password_instructions(user, url)
        end)

      conn =
        put(conn, ~p"/users/reset-password/#{token}", %{
          "user" => %{
            "password" => "too short",
            "password_confirmation" => "does not match"
          }
        })

      response = html_response(conn, 200)
      assert response =~ "Reset password"
      assert response =~ "should be at least 12 character(s)"
      assert response =~ "does not match password"
      assert Accounts.get_user_by_email_and_password(user.email, valid_user_password())
    end

    test "redirects when token is invalid", %{conn: conn} do
      conn =
        put(conn, ~p"/users/reset-password/invalid-token", %{
          "user" => %{
            "password" => "new valid password",
            "password_confirmation" => "new valid password"
          }
        })

      assert redirected_to(conn) == ~p"/users/reset-password"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "Reset password link is invalid or it has expired."
    end
  end
end
