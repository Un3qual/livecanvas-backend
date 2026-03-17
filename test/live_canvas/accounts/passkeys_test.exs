defmodule LC.Accounts.PasskeysTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.PasskeyTestSupport

  alias LC.Accounts
  alias LCSchemas.Accounts.UserToken

  describe "begin_passkey_challenge/2" do
    test "creates a signup challenge tied to a new unconfirmed user" do
      email = unique_user_email()

      with_fake_passkey_adapter(fn ->
        assert {:ok, %{user: user, challenge_token: challenge_token, payload_json: payload_json}} =
                 Accounts.begin_passkey_challenge(:sign_up, email)

        assert user.email == email
        refute user.confirmed_at
        assert is_binary(challenge_token)

        assert %{"challenge" => _challenge, "rp" => %{"id" => "livecanvas.invalid"}} =
                 Jason.decode!(payload_json)

        assert 1 ==
                 Repo.aggregate(
                   from(token in UserToken,
                     where:
                       token.context == :passkey_registration_challenge_token and
                         token.user_id == ^user.id and
                         token.sent_to == ^email
                   ),
                   :count,
                   :id
                 )
      end)
    end
  end

  describe "sign_up_with_passkey/1" do
    test "confirms the user, stores the passkey, and issues auth tokens" do
      email = unique_user_email()

      with_fake_passkey_adapter(fn ->
        assert {:ok, %{challenge_token: challenge_token}} =
                 Accounts.begin_passkey_challenge(:sign_up, email)

        assert {:ok, %{user: user, access_token: access_token, refresh_token: refresh_token}} =
                 Accounts.sign_up_with_passkey(
                   registration_passkey_input(challenge_token, credential_id: "signup-passkey")
                 )

        assert user.confirmed_at
        assert access_token.user_token.context == :access_token
        assert refresh_token.user_token.context == :refresh_token
        assert Accounts.get_user_by_identity(:passkey_provider, "signup-passkey").id == user.id

        assert [%{credential_id: "signup-passkey", sign_count: 0}] =
                 Repo.all(
                   from(passkey in "user_passkeys",
                     where: field(passkey, :user_id) == ^user.id,
                     select: %{
                       credential_id: field(passkey, :credential_id),
                       sign_count: field(passkey, :sign_count)
                     }
                   )
                 )
      end)
    end
  end

  describe "log_in_with_passkey/1" do
    test "verifies an assertion, updates sign_count, and issues auth tokens" do
      email = unique_user_email()

      with_fake_passkey_adapter(fn ->
        assert {:ok, %{challenge_token: signup_challenge_token}} =
                 Accounts.begin_passkey_challenge(:sign_up, email)

        assert {:ok, %{user: user}} =
                 Accounts.sign_up_with_passkey(
                   registration_passkey_input(signup_challenge_token,
                     credential_id: "login-passkey"
                   )
                 )

        assert {:ok, %{challenge_token: login_challenge_token, payload_json: payload_json}} =
                 Accounts.begin_passkey_challenge(:log_in, email)

        assert %{
                 "allowCredentials" => [%{"id" => "login-passkey", "type" => "public-key"}]
               } = Jason.decode!(payload_json)

        assert {:ok,
                %{user: logged_in_user, access_token: access_token, refresh_token: refresh_token}} =
                 Accounts.log_in_with_passkey(
                   assertion_passkey_input(login_challenge_token, "login-passkey", sign_count: 7)
                 )

        assert logged_in_user.id == user.id
        assert access_token.user_token.context == :access_token
        assert refresh_token.user_token.context == :refresh_token

        assert [%{credential_id: "login-passkey", sign_count: 7}] =
                 Repo.all(
                   from(passkey in "user_passkeys",
                     where: field(passkey, :user_id) == ^user.id,
                     select: %{
                       credential_id: field(passkey, :credential_id),
                       sign_count: field(passkey, :sign_count)
                     }
                   )
                 )
      end)
    end
  end
end
