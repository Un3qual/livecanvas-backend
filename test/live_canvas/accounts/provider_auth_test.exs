defmodule LC.Accounts.ProviderAuthTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.ProviderAuthTestSupport

  alias LC.Accounts
  alias LC.Accounts.ProviderAuth
  alias LCSchemas.Accounts.UserIdentity

  describe "ProviderAuth.verify/2" do
    test "verifies Google id tokens against configured JWKS and claims" do
      bundle = provider_token_bundle(:google)

      with_provider_configs([google: bundle.config], fn ->
        assert {:ok, verified_identity} = ProviderAuth.verify(:google, bundle.token)
        assert verified_identity.provider == :google_provider
        assert verified_identity.provider_uid == bundle.claims["sub"]
        assert verified_identity.email == bundle.claims["email"]
        assert verified_identity.provider_data["issuer"] == bundle.claims["iss"]
      end)
    end

    test "rejects Apple id tokens without a verified email claim" do
      bundle = provider_token_bundle(:apple, claims: %{"email_verified" => "false"})

      with_provider_configs([apple: bundle.config], fn ->
        assert {:error, :provider_verification_failed} = ProviderAuth.verify(:apple, bundle.token)
      end)
    end
  end

  describe "sign_up_with_provider/2" do
    test "creates a confirmed Google-backed account, linked identity, and auth tokens" do
      bundle = provider_token_bundle(:google)

      with_provider_configs([google: bundle.config], fn ->
        assert {:ok, %{user: user, access_token: access_token, refresh_token: refresh_token}} =
                 Accounts.sign_up_with_provider(:google, bundle.token)

        assert user.email == bundle.claims["email"]
        assert user.confirmed_at
        assert access_token.user_token.context == :access_token
        assert refresh_token.user_token.context == :refresh_token

        assert %UserIdentity{} =
                 identity =
                 Repo.get_by(UserIdentity, user_id: user.id, provider: :google_provider)

        assert identity.provider_uid == bundle.claims["sub"]
        assert identity.provider_data["email"] == bundle.claims["email"]
        assert identity.last_used_at
      end)
    end

    test "returns provider_verification_failed when the provider identity is already linked" do
      bundle = provider_token_bundle(:google)

      with_provider_configs([google: bundle.config], fn ->
        assert {:ok, _auth_entry} = Accounts.sign_up_with_provider(:google, bundle.token)

        assert {:error, :provider_verification_failed} =
                 Accounts.sign_up_with_provider(:google, bundle.token)
      end)
    end

    test "returns provider_verification_failed when the provider identity was revoked" do
      bundle = provider_token_bundle(:google)
      user = user_fixture()

      _revoked_identity =
        attach_user_identity(user, :google_provider, bundle.claims["sub"],
          provider_data: %{"email" => bundle.claims["email"]},
          revoked_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
        )

      with_provider_configs([google: bundle.config], fn ->
        assert {:error, :provider_verification_failed} =
                 Accounts.sign_up_with_provider(:google, bundle.token)
      end)
    end

    test "returns email_taken when another account already owns the provider email" do
      bundle = provider_token_bundle(:google)
      _existing_user = user_fixture(%{email: bundle.claims["email"]})

      with_provider_configs([google: bundle.config], fn ->
        assert {:error, :email_taken} = Accounts.sign_up_with_provider(:google, bundle.token)
      end)
    end
  end

  describe "log_in_with_provider/2" do
    test "issues auth tokens for an existing Apple identity" do
      bundle = provider_token_bundle(:apple)
      user = user_fixture(%{email: bundle.claims["email"]})

      _identity =
        attach_user_identity(user, :apple_provider, bundle.claims["sub"],
          provider_data: %{"email" => bundle.claims["email"]}
        )

      with_provider_configs([apple: bundle.config], fn ->
        assert {:ok,
                %{user: logged_in_user, access_token: access_token, refresh_token: refresh_token}} =
                 Accounts.log_in_with_provider(:apple, bundle.token)

        assert logged_in_user.id == user.id
        assert access_token.user_token.context == :access_token
        assert refresh_token.user_token.context == :refresh_token

        assert %UserIdentity{} =
                 identity =
                 Repo.get_by(UserIdentity, user_id: user.id, provider: :apple_provider)

        assert identity.last_used_at
      end)
    end

    test "does not log in users by email without a linked provider identity" do
      bundle = provider_token_bundle(:apple)
      _user = user_fixture(%{email: bundle.claims["email"]})

      with_provider_configs([apple: bundle.config], fn ->
        assert {:error, :provider_verification_failed} =
                 Accounts.log_in_with_provider(:apple, bundle.token)
      end)
    end
  end
end
