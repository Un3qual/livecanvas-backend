defmodule LC.Accounts.RefreshTokenLifecycleTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts

  describe "issue_refresh_token/2" do
    test "persists a refresh token payload" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: persisted}} = Accounts.issue_refresh_token(user)
      assert is_binary(token)
      assert persisted.context == :refresh_token
      assert persisted.user_id == user.id

      assert {:ok, %{id: decoded_id}} = Accounts.Tokens.decode_serialized_value(token)
      assert decoded_id == persisted.id
    end
  end

  describe "authenticate_refresh_token/1" do
    test "returns a scope for a valid refresh token" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_refresh_token(user)

      assert {:ok, %{user: %{id: user_id}}} = Accounts.authenticate_refresh_token(token)
      assert user_id == user.id
    end

    test "returns invalid_token for malformed token payloads" do
      assert {:error, :invalid_token} = Accounts.authenticate_refresh_token("not-a-token")
    end

    test "returns expired_token when token validity has elapsed" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_refresh_token(user)
      offset_user_token(token, -31, :day)

      assert {:error, :expired_token} = Accounts.authenticate_refresh_token(token)
    end

    test "returns revoked_token when token row has been deleted" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_refresh_token(user)

      :ok = Accounts.revoke_refresh_token(token)

      assert {:error, :revoked_token} = Accounts.authenticate_refresh_token(token)
    end
  end

  describe "rotate_refresh_token/1" do
    test "revokes the existing refresh token and issues a new access/refresh pair" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_refresh_token(user)

      assert {:ok,
              %{
                access_token: %{token: fresh_access_token},
                refresh_token: %{token: fresh_refresh_token}
              }} = Accounts.rotate_refresh_token(token)

      assert {:error, :revoked_token} = Accounts.authenticate_refresh_token(token)

      assert {:ok, %{user: %{id: user_id}}} =
               Accounts.authenticate_access_token(fresh_access_token)

      assert {:ok, %{user: %{id: ^user_id}}} =
               Accounts.authenticate_refresh_token(fresh_refresh_token)

      assert user_id == user.id
    end
  end

  describe "revoke_refresh_token/1" do
    test "revokes refresh tokens idempotently" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_refresh_token(user)

      assert :ok = Accounts.revoke_refresh_token(token)
      assert :ok = Accounts.revoke_refresh_token(token)
      assert {:error, :revoked_token} = Accounts.authenticate_refresh_token(token)
    end
  end
end
