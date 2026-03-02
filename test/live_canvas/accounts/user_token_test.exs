defmodule LiveCanvas.Accounts.UserTokenTest do
  use LiveCanvas.DataCase

  alias LiveCanvas.Accounts
  alias LiveCanvasSchemas.Accounts.UserToken

  import LiveCanvas.AccountsFixtures

  describe "issue_user_token/3" do
    test "stores only the secret hash" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: %UserToken{} = persisted}} =
               Accounts.issue_user_token(user, :access_token)

      assert is_binary(token)
      assert persisted.secret_hash != token
      assert persisted.context == :access_token
    end
  end

  describe "public token wrappers" do
    test "issue_access_token/2 persists an access token payload" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: %UserToken{} = persisted}} =
               Accounts.issue_access_token(user)

      assert is_binary(token)
      assert persisted.context == :access_token
      assert persisted.user_id == user.id
    end

    test "issue_magic_link_token/1 uses the email magic link context" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: %UserToken{} = persisted}} =
               Accounts.issue_magic_link_token(user)

      assert is_binary(token)
      assert persisted.context == :email_magic_link_token
      assert persisted.sent_to == user.email
      assert persisted.user_id == user.id
    end

    test "issue_email_verification_token/1 uses the email verification context" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: %UserToken{} = persisted}} =
               Accounts.issue_email_verification_token(user)

      assert is_binary(token)
      assert persisted.context == :email_verification_token
      assert persisted.sent_to == user.email
      assert persisted.user_id == user.id
    end
  end
end
