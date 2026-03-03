defmodule LC.Accounts.UserTokenTest do
  use LC.DataCase

  alias LC.Accounts
  alias LCSchemas.Accounts.UserToken

  import LC.AccountsFixtures

  describe "issue_user_token/3" do
    test "stores only the secret hash" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: %UserToken{} = persisted}} =
               Accounts.issue_user_token(user, :access_token)

      assert is_binary(token)
      assert persisted.secret_hash != token
      assert persisted.context == :access_token
    end

    test "hashes token secrets with sha3-256" do
      raw_secret = "secret-value"

      assert Accounts.Tokens.secret_hash(raw_secret) == :crypto.hash(:sha3_256, raw_secret)
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

      assert {:ok, %{id: decoded_id}} = Accounts.Tokens.decode_serialized_value(token)
      assert decoded_id == persisted.id
      assert_uuid_v7!(decoded_id)
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

    test "issue_phone_verification_token/2 normalizes the phone and uses the phone verification context" do
      user = user_fixture()
      {:ok, _join} = Accounts.attach_user_phone_number(user, "(650) 253-0000")

      assert {:ok, %{token: token, user_token: persisted, phone_number: "+16502530000"}} =
               Accounts.issue_phone_verification_token(user, "650-253-0000")

      assert is_binary(token)
      assert persisted.context == :phone_verification_token
      assert persisted.sent_to == "+16502530000"
      assert persisted.user_id == user.id
    end

    test "issue_phone_verification_token/2 returns an error for invalid phone input" do
      user = user_fixture()

      assert {:error, :invalid_phone_number} =
               Accounts.issue_phone_verification_token(user, "123")
    end

    test "issue_phone_verification_token/2 returns an error when the user does not own the phone number" do
      user = user_fixture()

      assert {:error, :phone_number_not_found} =
               Accounts.issue_phone_verification_token(user, "650-253-0000")
    end
  end

  defp assert_uuid_v7!(uuid) when is_binary(uuid) do
    assert String.at(uuid, 14) == "7"
  end
end
