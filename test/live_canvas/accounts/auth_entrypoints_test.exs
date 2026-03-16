defmodule LC.Accounts.AuthEntrypointsTest do
  use LC.DataCase

  import Ecto.Query
  import LC.AccountsFixtures

  alias LC.Accounts
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.UserToken

  describe "sign_up_with_password/1" do
    test "creates an unconfirmed user with password credentials and auth tokens" do
      email = unique_user_email()
      password = valid_user_password()

      assert {:ok, %{user: user, access_token: access_token, refresh_token: refresh_token}} =
               Accounts.sign_up_with_password(%{
                 email: email,
                 password: password,
                 password_confirmation: password
               })

      assert user.email == email
      refute is_nil(user.hashed_password)
      refute user.confirmed_at
      assert Accounts.get_user_by_email_and_password(email, password)
      assert access_token.user_token.context == :access_token
      assert refresh_token.user_token.context == :refresh_token
      assert access_token.user_token.user_id == user.id
      assert refresh_token.user_token.user_id == user.id
    end

    test "returns email_taken when the email already exists" do
      _user = user_fixture(%{email: "duplicate-password@example.com"})

      assert {:error, :email_taken} =
               Accounts.sign_up_with_password(%{
                 email: "duplicate-password@example.com",
                 password: valid_user_password(),
                 password_confirmation: valid_user_password()
               })
    end
  end

  describe "log_in_with_password/1" do
    test "issues auth tokens for valid credentials" do
      user = user_fixture(%{email: "password-login@example.com"}) |> set_password()

      assert {:ok,
              %{user: logged_in_user, access_token: access_token, refresh_token: refresh_token}} =
               Accounts.log_in_with_password(%{
                 email: user.email,
                 password: valid_user_password()
               })

      assert logged_in_user.id == user.id
      assert access_token.user_token.context == :access_token
      assert refresh_token.user_token.context == :refresh_token
    end

    test "returns invalid_credentials for unknown or incorrect passwords" do
      user = user_fixture(%{email: "invalid-password@example.com"}) |> set_password()

      assert {:error, :invalid_credentials} =
               Accounts.log_in_with_password(%{
                 email: user.email,
                 password: "incorrect password"
               })

      assert {:error, :invalid_credentials} =
               Accounts.log_in_with_password(%{
                 email: "missing-password@example.com",
                 password: valid_user_password()
               })
    end
  end

  describe "begin_magic_link_challenge/3" do
    test "creates a new signup user and magic-link token" do
      email = unique_user_email()

      assert {:ok, %{user: user, dispatched: true}} =
               Accounts.begin_magic_link_challenge(
                 :sign_up,
                 email,
                 &"https://livecanvas.invalid/users/log-in/#{&1}"
               )

      assert user.email == email
      refute user.confirmed_at

      assert %UserToken{context: :email_magic_link_token, sent_to: ^email, user_id: user_id} =
               Repo.one(
                 from(token in UserToken,
                   where: token.context == :email_magic_link_token and token.sent_to == ^email,
                   order_by: [desc: token.inserted_at],
                   limit: 1
                 )
               )

      assert user_id == user.id
    end

    test "returns email_taken when the signup email already exists" do
      _user = unconfirmed_user_fixture(%{email: "taken-signup@example.com"})

      assert {:error, :email_taken} =
               Accounts.begin_magic_link_challenge(
                 :sign_up,
                 "taken-signup@example.com",
                 &"https://livecanvas.invalid/users/log-in/#{&1}"
               )
    end

    test "keeps login responses enumeration-safe for unknown emails" do
      assert {:ok, %{user: nil, dispatched: true}} =
               Accounts.begin_magic_link_challenge(
                 :log_in,
                 "missing-magic-link@example.com",
                 &"https://livecanvas.invalid/users/log-in/#{&1}"
               )

      assert 0 ==
               Repo.aggregate(
                 from(token in UserToken, where: token.context == :email_magic_link_token),
                 :count,
                 :id
               )
    end

    test "does not issue a login magic link for unconfirmed password users" do
      password = valid_user_password()

      assert {:ok, %{user: user}} =
               Accounts.sign_up_with_password(%{
                 email: "password-magic-link-blocked@example.com",
                 password: password,
                 password_confirmation: password
               })

      assert {:ok, %{user: nil, dispatched: true}} =
               Accounts.begin_magic_link_challenge(
                 :log_in,
                 user.email,
                 &"https://livecanvas.invalid/users/log-in/#{&1}"
               )

      assert 0 ==
               Repo.aggregate(
                 from(token in UserToken,
                   where: token.context == :email_magic_link_token and token.user_id == ^user.id
                 ),
                 :count,
                 :id
               )
    end
  end

  describe "sign_up_with_magic_link/1" do
    test "confirms the user and issues auth tokens" do
      user = unconfirmed_user_fixture(%{email: "magic-signup@example.com"})
      {token, _secret_hash} = generate_user_magic_link_token(user)

      assert {:ok,
              %{user: signed_up_user, access_token: access_token, refresh_token: refresh_token}} =
               Accounts.sign_up_with_magic_link(token)

      assert signed_up_user.id == user.id
      assert signed_up_user.confirmed_at
      assert access_token.user_token.context == :access_token
      assert refresh_token.user_token.context == :refresh_token
    end
  end

  describe "log_in_with_magic_link/1" do
    test "issues auth tokens for confirmed users and consumes the link" do
      user = user_fixture(%{email: "magic-login@example.com"})
      {token, _secret_hash} = generate_user_magic_link_token(user)

      assert {:ok,
              %{user: logged_in_user, access_token: access_token, refresh_token: refresh_token}} =
               Accounts.log_in_with_magic_link(token)

      assert logged_in_user.id == user.id
      assert access_token.user_token.context == :access_token
      assert refresh_token.user_token.context == :refresh_token
      assert {:error, :invalid_credentials} = Accounts.log_in_with_magic_link(token)
    end
  end
end
