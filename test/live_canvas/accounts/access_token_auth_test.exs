defmodule LC.Accounts.AccessTokenAuthTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts

  describe "authenticate_access_token/1" do
    test "returns a scope for a valid access token" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_access_token(user)

      assert {:ok, %{user: %{id: user_id}}} = Accounts.authenticate_access_token(token)
      assert user_id == user.id
    end

    test "returns invalid_token for malformed token payloads" do
      assert {:error, :invalid_token} = Accounts.authenticate_access_token("not-a-token")
    end

    test "returns invalid_token when the token secret is tampered" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_access_token(user)

      tampered_token = token <> "x"

      assert {:error, :invalid_token} = Accounts.authenticate_access_token(tampered_token)
    end

    test "returns expired_token when token validity has elapsed" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_access_token(user)
      offset_user_token(token, -15, :day)

      assert {:error, :expired_token} = Accounts.authenticate_access_token(token)
    end

    test "returns revoked_token when token row has been deleted" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_access_token(user)

      :ok = Accounts.delete_user_session_token(token)

      assert {:error, :revoked_token} = Accounts.authenticate_access_token(token)
    end
  end
end
