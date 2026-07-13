defmodule LC.AccountsTest do
  use LC.DataCase

  import ExUnit.CaptureLog

  require Logger

  alias LC.Accounts

  import LC.AccountsFixtures
  alias LC.Accounts.Tokens

  alias LCSchemas.Accounts.{
    ContactInviteConversion,
    StaffPermission,
    User,
    UserContactEntry,
    UserEmailAddress,
    UserToken
  }

  describe "schema shape" do
    test "user exposes join and through email relationships" do
      assert :user_email_addresses in User.__schema__(:associations)
      assert :email_addresses in User.__schema__(:associations)
      assert :phone_numbers in User.__schema__(:associations)
      refute :email in User.__schema__(:fields)
    end

    test "contact entries expose through email and phone relationships" do
      assert :email_addresses in UserContactEntry.__schema__(:associations)
      assert :phone_numbers in UserContactEntry.__schema__(:associations)
    end

    test "relational schemas expose entropy_id while user tokens keep UUID primary keys" do
      assert :entropy_id in User.__schema__(:fields)
      assert :entropy_id in UserContactEntry.__schema__(:fields)

      assert :secret_hash in UserToken.__schema__(:fields)
      assert "binary_id" == Atom.to_string(UserToken.__schema__(:type, :id))
      assert :raw_secret in UserToken.__schema__(:virtual_fields)
      assert :serialized_value in UserToken.__schema__(:virtual_fields)
      refute :entropy_id in UserToken.__schema__(:fields)
      refute :token in UserToken.__schema__(:virtual_fields)

      assert :entropy_id in ContactInviteConversion.__schema__(:fields)
      assert :invite_secret_hash in ContactInviteConversion.__schema__(:fields)
      refute :raw_secret in ContactInviteConversion.__schema__(:fields)
      refute :recipient_email in ContactInviteConversion.__schema__(:fields)
    end

    test "reloading a relational row returns a populated entropy_id" do
      user = user_fixture()
      reloaded_user = Accounts.get_user!(user.id)

      assert is_binary(Map.get(reloaded_user, :entropy_id))
    end

    test "contact invite conversion foreign keys have supporting indexes" do
      assert {:ok, %{rows: rows}} =
               Repo.query("""
               SELECT indexname
               FROM pg_indexes
               WHERE schemaname = current_schema()
                 AND tablename = 'contact_invite_conversions'
               """)

      index_names = rows |> List.flatten() |> MapSet.new()

      assert MapSet.member?(index_names, "contact_invite_conversions_inviter_id_index")

      assert MapSet.member?(
               index_names,
               "contact_invite_conversions_recipient_user_id_index"
             )
    end

    test "tokens expose dedicated serialization helpers" do
      assert {:ok, parts} =
               Tokens.decode_serialized_value("#{Ecto.UUID.generate()}.c2VjcmV0")

      assert is_binary(parts.id)
      assert is_binary(parts.raw_secret)
    end
  end

  describe "get_user_by_email/1" do
    test "does not return the user if the email does not exist" do
      refute Accounts.get_user_by_email("unknown@example.com")
    end

    test "returns the user if the email exists" do
      %{id: id} = user = user_fixture()
      assert %User{id: ^id} = Accounts.get_user_by_email(user.email)
    end
  end

  describe "get_user_by_email_and_password/2" do
    test "does not return the user if the email does not exist" do
      refute Accounts.get_user_by_email_and_password("unknown@example.com", "hello world!")
    end

    test "does not return the user if the password is not valid" do
      user = user_fixture() |> set_password()
      refute Accounts.get_user_by_email_and_password(user.email, "invalid")
    end

    test "returns the user if the email and password are valid" do
      %{id: id} = user = user_fixture() |> set_password()

      assert %User{id: ^id} =
               Accounts.get_user_by_email_and_password(user.email, valid_user_password())
    end

    test "does not return suspended users even when credentials are valid" do
      user = user_fixture() |> set_password()
      assert {:ok, _suspended_user} = Accounts.suspend_user(user)

      refute Accounts.get_user_by_email_and_password(user.email, valid_user_password())
    end
  end

  describe "get_user_by_phone/1" do
    test "does not return the user if the phone does not exist" do
      refute Accounts.get_user_by_phone("+15555550123")
    end

    test "returns the user if the phone exists" do
      %{id: id} = user = user_fixture()
      attach_phone_number(user, "(650) 253-0000")

      assert %User{id: ^id} = Accounts.get_user_by_phone("+1 650-253-0000")
    end
  end

  describe "get_user_by_identity/2" do
    test "does not return the user if the identity does not exist" do
      refute Accounts.get_user_by_identity(:google_provider, "missing-google-user")
    end

    test "returns the user if the active identity exists" do
      %{id: id} = user = user_fixture()
      attach_user_identity(user, :google_provider, "google-user-1")

      assert %User{id: ^id} =
               Accounts.get_user_by_identity(:google_provider, "google-user-1")
    end

    test "does not return the user if the identity is revoked" do
      user = user_fixture()

      attach_user_identity(user, :google_provider, "google-user-2",
        revoked_at: DateTime.utc_now()
      )

      refute Accounts.get_user_by_identity(:google_provider, "google-user-2")
    end
  end

  describe "attach_user_phone_number/3" do
    test "normalizes and attaches the phone number" do
      user = user_fixture()
      verified_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

      assert {:ok, join} =
               Accounts.attach_user_phone_number(user, "(650) 253-0000", verified_at: verified_at)

      assert join.user_id == user.id
      assert DateTime.compare(join.verified_at, verified_at) == :eq

      user = Accounts.get_user!(user.id) |> Repo.preload(user_phone_numbers: :phone_number)
      [persisted_join] = user.user_phone_numbers

      assert persisted_join.phone_number.normalized_e164 == "+16502530000"
    end

    test "returns an error for invalid phone input" do
      user = user_fixture()

      assert {:error, :invalid_phone_number} = Accounts.attach_user_phone_number(user, "123")
    end
  end

  describe "attach_user_email_address/3" do
    test "downcases and persists a verified join" do
      user = user_fixture()
      verified_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

      assert {:ok, join} =
               Accounts.attach_user_email_address(user, "NEW@Example.com",
                 verified_at: verified_at
               )

      assert join.user_id == user.id
      assert DateTime.compare(join.verified_at, verified_at) == :eq
      assert join.email_address.normalized_email == "new@example.com"

      user = Accounts.get_user!(user.id) |> Repo.preload(user_email_addresses: :email_address)

      assert Enum.any?(
               user.user_email_addresses,
               &(&1.email_address.normalized_email == "new@example.com")
             )
    end
  end

  describe "register_user_identity/4" do
    test "stores the identity and makes it discoverable" do
      %{id: id} = user = user_fixture()

      assert {:ok, identity} =
               Accounts.register_user_identity(
                 user,
                 :google_provider,
                 "google-user-3",
                 provider_data: %{"email" => user.email},
                 encrypted_tokens: <<1, 2, 3>>
               )

      assert identity.user_id == user.id
      assert identity.provider == :google_provider
      assert identity.provider_uid == "google-user-3"
      assert identity.provider_data == %{"email" => user.email}
      assert identity.encrypted_tokens == <<1, 2, 3>>
      assert is_nil(identity.revoked_at)

      assert %User{id: ^id} =
               Accounts.get_user_by_identity(:google_provider, "google-user-3")
    end
  end

  describe "unlink_user_identity/2" do
    test "revokes an owned identity and makes it undiscoverable" do
      user = user_fixture() |> set_password()

      identity =
        attach_user_identity(user, :google_provider, "google-user-unlink-success",
          provider_data: %{"email" => user.email}
        )

      assert {:ok, revoked_identity} = Accounts.unlink_user_identity(user, identity.id)
      assert revoked_identity.id == identity.id
      assert %DateTime{} = revoked_identity.revoked_at

      refute Accounts.get_user_by_identity(:google_provider, "google-user-unlink-success")
    end

    test "returns not_found for unowned identity ids" do
      user = user_fixture()
      other_user = user_fixture()

      identity =
        attach_user_identity(other_user, :apple_provider, "apple-user-unlink-unowned")

      assert {:error, :not_found} = Accounts.unlink_user_identity(user, identity.id)
    end

    test "returns already_revoked when unlink is repeated" do
      user = user_fixture() |> set_password()
      identity = attach_user_identity(user, :google_provider, "google-user-unlink-repeat")

      assert {:ok, _revoked_identity} = Accounts.unlink_user_identity(user, identity.id)
      assert {:error, :already_revoked} = Accounts.unlink_user_identity(user, identity.id)
    end

    test "protects the last active identity for a passwordless user" do
      user = user_fixture()
      identity = attach_user_identity(user, :google_provider, "google-user-last-sign-in")

      refute Accounts.user_identity_unlinkable?(user, identity.id)
      assert {:error, :last_sign_in_method} = Accounts.unlink_user_identity(user, identity.id)
      assert Accounts.get_active_user_identity(user, identity.id)
    end

    test "allows a passwordless user to unlink either of multiple active identities" do
      user = user_fixture()
      first_identity = attach_user_identity(user, :google_provider, "google-user-first-sign-in")
      second_identity = attach_user_identity(user, :apple_provider, "apple-user-second-sign-in")

      assert Accounts.user_identity_unlinkable?(user, first_identity.id)
      assert Accounts.user_identity_unlinkable?(user, second_identity.id)
      assert {:ok, _revoked_identity} = Accounts.unlink_user_identity(user, first_identity.id)

      refute Accounts.user_identity_unlinkable?(user, second_identity.id)
    end

    test "does not count legacy identities as alternate sign-in methods" do
      user = user_fixture()

      sign_in_identity =
        attach_user_identity(user, :google_provider, "google-user-with-legacy-identity")

      legacy_identity =
        attach_user_identity(user, :instagram_provider, "instagram-user-legacy-identity")

      refute Accounts.user_identity_unlinkable?(user, sign_in_identity.id)
      assert Accounts.user_identity_unlinkable?(user, legacy_identity.id)

      assert {:error, :last_sign_in_method} =
               Accounts.unlink_user_identity(user, sign_in_identity.id)

      assert Accounts.get_active_user_identity(user, sign_in_identity.id)
    end
  end

  describe "upsert_user_contact_entry/2" do
    test "creates a contact entry and normalizes linked identifiers" do
      user = user_fixture()

      assert {:ok, contact_entry} =
               Accounts.upsert_user_contact_entry(user, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 contact_name: "Friend One",
                 birthday: ~D[1991-04-05],
                 emails: ["Friend@One.Example", "friend@one.example"],
                 phone_numbers: ["(650) 253-0000", "+1 650 253 0000"]
               })

      assert contact_entry.user_id == user.id
      assert contact_entry.contact_name == "Friend One"
      assert contact_entry.birthday == ~D[1991-04-05]

      assert ["friend@one.example"] ==
               contact_entry.email_addresses
               |> Enum.map(& &1.normalized_email)
               |> Enum.sort()

      assert ["+16502530000"] ==
               contact_entry.phone_numbers
               |> Enum.map(& &1.normalized_e164)
               |> Enum.sort()
    end

    test "upserts by contact client id instead of duplicating entries" do
      user = user_fixture()
      contact_client_id = :crypto.strong_rand_bytes(16)

      assert {:ok, first_entry} =
               Accounts.upsert_user_contact_entry(user, %{
                 contact_client_id: contact_client_id,
                 contact_name: "Original Name",
                 emails: ["original@example.com"],
                 phone_numbers: ["+16502530000"]
               })

      assert {:ok, second_entry} =
               Accounts.upsert_user_contact_entry(user, %{
                 contact_client_id: contact_client_id,
                 contact_name: "Updated Name",
                 emails: ["updated@example.com"],
                 phone_numbers: []
               })

      assert second_entry.id == first_entry.id

      assert 1 ==
               Repo.aggregate(
                 from(contact_entry in UserContactEntry,
                   where: contact_entry.user_id == ^user.id
                 ),
                 :count,
                 :id
               )

      assert second_entry.contact_name == "Updated Name"

      assert ["updated@example.com"] ==
               Enum.map(second_entry.email_addresses, & &1.normalized_email)

      assert [] == second_entry.phone_numbers
    end

    test "returns an error for invalid phone input" do
      user = user_fixture()

      assert {:error, :invalid_phone_number} =
               Accounts.upsert_user_contact_entry(user, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 phone_numbers: ["123"]
               })
    end
  end

  describe "list_user_contact_matches/1" do
    test "returns deterministic match records and excludes self matches" do
      owner = user_fixture(email: "a-owner@example.com")
      email_match = user_fixture(email: "z-email-match@example.com")
      phone_match = user_fixture()

      assert {:ok, _owner_alias} =
               Accounts.attach_user_email_address(owner, "b-owner-alias@example.com")

      attach_phone_number(phone_match, "(650) 253-0001",
        verified_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
      )

      assert {:ok, _contact_entry} =
               Accounts.upsert_user_contact_entry(owner, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 contact_name: "Known Friend",
                 emails: [email_match.email, owner.email, "b-owner-alias@example.com"],
                 phone_numbers: ["+1 650-253-0001"]
               })

      assert [
               %{
                 contact_entry: %{contact_name: "Known Friend"},
                 invite_recipient: invite_recipient,
                 matched_users: matched_users
               }
             ] = Accounts.list_user_contact_matches(owner)

      assert invite_recipient == email_match.email
      assert Enum.map(matched_users, & &1.id) == Enum.sort([email_match.id, phone_match.id])
      refute Enum.any?(matched_users, &(&1.id == owner.id))
      assert Enum.all?(matched_users, &(is_binary(&1.email) and String.contains?(&1.email, "@")))
    end

    test "matches only users with verified contact identifiers" do
      owner = user_fixture()
      verified_email_match = user_fixture()
      unverified_email_match = unconfirmed_user_fixture()
      verified_phone_match = user_fixture()
      unverified_phone_match = user_fixture()
      verified_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

      attach_phone_number(verified_phone_match, "+1 650-253-0002", verified_at: verified_at)
      attach_phone_number(unverified_phone_match, "+1 650-253-0003")

      assert {:ok, _contact_entry} =
               Accounts.upsert_user_contact_entry(owner, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 emails: [verified_email_match.email, unverified_email_match.email],
                 phone_numbers: ["+1 650-253-0002", "+1 650-253-0003"]
               })

      assert [%{matched_users: matched_users}] = Accounts.list_user_contact_matches(owner)

      assert Enum.map(matched_users, & &1.id) ==
               Enum.sort([verified_email_match.id, verified_phone_match.id])

      refute Enum.any?(matched_users, &(&1.id == unverified_email_match.id))
      refute Enum.any?(matched_users, &(&1.id == unverified_phone_match.id))
    end

    test "matches a confirmed user's legacy primary email without a join verification timestamp" do
      owner = user_fixture()
      legacy_confirmed_match = user_fixture()

      assert {1, nil} =
               Repo.update_all(
                 from(user_email_address in UserEmailAddress,
                   where: user_email_address.user_id == ^legacy_confirmed_match.id
                 ),
                 set: [verified_at: nil]
               )

      assert {:ok, _contact_entry} =
               Accounts.upsert_user_contact_entry(owner, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 emails: [legacy_confirmed_match.email]
               })

      assert [%{matched_users: [%{id: matched_user_id}]}] =
               Accounts.list_user_contact_matches(owner)

      assert matched_user_id == legacy_confirmed_match.id
    end

    test "does not treat an unverified secondary email as verified by account confirmation" do
      owner = user_fixture()
      confirmed_user = user_fixture()
      secondary_email = unique_user_email()

      assert {:ok, join} =
               Accounts.attach_user_email_address(confirmed_user, secondary_email,
                 verified_at: nil
               )

      assert is_nil(join.verified_at)

      assert is_nil(
               Repo.get_by!(UserEmailAddress,
                 user_id: confirmed_user.id,
                 email_address_id: join.email_address_id
               ).verified_at
             )

      assert {:ok, _contact_entry} =
               Accounts.upsert_user_contact_entry(owner, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 emails: [secondary_email]
               })

      assert [%{matched_users: []}] = Accounts.list_user_contact_matches(owner)
    end

    test "returns an empty list when no contacts are imported" do
      assert [] = Accounts.list_user_contact_matches(user_fixture())
    end
  end

  describe "update_user_privacy_mode/2" do
    test "persists private visibility" do
      user = user_fixture()

      assert {:ok, updated_user} = Accounts.update_user_privacy_mode(user, :private)
      assert updated_user.privacy_mode == :private
      assert Accounts.get_user!(user.id).privacy_mode == :private
    end

    test "user_fixture/1 can build a public account" do
      user = user_fixture(privacy_mode: :public)

      assert user.privacy_mode == :public
    end
  end

  describe "suspend_user/1, unsuspend_user/1, and suspended?/1" do
    test "suspend_user/1 sets suspended_at with microsecond precision" do
      user = user_fixture()
      refute Accounts.suspended?(user)

      assert {:ok, suspended_user} = Accounts.suspend_user(user)
      assert %DateTime{} = suspended_user.suspended_at
      assert suspended_user.suspended_at.microsecond != {0, 0}

      assert Accounts.suspended?(user)
      assert %DateTime{} = Accounts.get_user!(user.id).suspended_at
    end

    test "unsuspend_user/1 clears suspended_at and is idempotent" do
      user = user_fixture()
      assert {:ok, _suspended_user} = Accounts.suspend_user(user)
      assert Accounts.suspended?(user)

      assert {:ok, unsuspended_user} = Accounts.unsuspend_user(user)
      assert is_nil(unsuspended_user.suspended_at)
      refute Accounts.suspended?(user)

      assert {:ok, unsuspended_again} = Accounts.unsuspend_user(user)
      assert is_nil(unsuspended_again.suspended_at)
      refute Accounts.suspended?(user)
    end
  end

  describe "get_user!/1" do
    test "raises if id is invalid" do
      assert_raise Ecto.NoResultsError, fn ->
        Accounts.get_user!(-1)
      end
    end

    test "returns the user with the given id" do
      %{id: id} = user = user_fixture()
      assert %User{id: ^id} = Accounts.get_user!(user.id)
    end
  end

  describe "register_user/1" do
    test "requires email to be set" do
      {:error, changeset} = Accounts.register_user(%{})

      assert %{email: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates email when given" do
      {:error, changeset} = Accounts.register_user(%{email: "not valid"})

      assert %{email: ["must have the @ sign and no spaces"]} = errors_on(changeset)
    end

    test "validates maximum values for email for security" do
      too_long = String.duplicate("db", 100)
      {:error, changeset} = Accounts.register_user(%{email: too_long})
      assert "should be at most 160 character(s)" in errors_on(changeset).email
    end

    test "validates email uniqueness" do
      %{email: email} = user_fixture()
      {:error, changeset} = Accounts.register_user(%{email: email})
      assert "has already been taken" in errors_on(changeset).email

      # Now try with the uppercased email too, to check that email case is ignored.
      {:error, changeset} = Accounts.register_user(%{email: String.upcase(email)})
      assert "has already been taken" in errors_on(changeset).email
    end

    test "registers users without password" do
      email = unique_user_email()
      {:ok, user} = Accounts.register_user(valid_user_attributes(email: email))
      assert user.email == email
      assert is_nil(user.hashed_password)
      assert is_nil(user.confirmed_at)
      assert is_nil(user.password)
    end
  end

  describe "register_user_with_email/1" do
    test "creates a verified normalized email join" do
      assert {:ok, user} = Accounts.register_user_with_email(%{email: "USER@example.com"})

      user = Repo.preload(user, user_email_addresses: :email_address)
      [join] = user.user_email_addresses

      assert %DateTime{} = join.verified_at
      assert join.email_address.normalized_email == "user@example.com"
    end
  end

  describe "registration_changeset/2" do
    test "returns a registration changeset without constructing a schema outside the context" do
      assert %Ecto.Changeset{} = changeset = Accounts.registration_changeset()
      assert changeset.required == [:email]
    end
  end

  describe "scope helpers" do
    test "scope_for_user/1 wraps the user in a scope" do
      user = user_fixture()
      assert %{user: ^user} = Accounts.scope_for_user(user)
    end

    test "scope_for_user/1 includes active staff permissions" do
      user = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(user, :post_report_moderation)

      assert %{user: ^user, staff_permissions: staff_permissions} = Accounts.scope_for_user(user)
      assert MapSet.equal?(staff_permissions, MapSet.new([:post_report_moderation]))
    end

    test "empty_scope/0 returns nil" do
      assert is_nil(Accounts.empty_scope())
    end
  end

  describe "staff permissions" do
    test "grants one active staff permission per user and permission" do
      user = user_fixture()

      assert {:ok, %{__struct__: StaffPermission} = permission} =
               Accounts.grant_staff_permission(user, :post_report_moderation)

      assert permission.user_id == user.id
      assert permission.permission == :post_report_moderation
      assert is_binary(permission.entropy_id)
      assert %DateTime{} = permission.granted_at
      assert is_nil(permission.revoked_at)

      assert [%{__struct__: StaffPermission, id: permission_id}] =
               Accounts.list_active_staff_permissions(user)

      assert permission_id == permission.id

      assert {:ok, %{__struct__: StaffPermission, id: ^permission_id}} =
               Accounts.grant_staff_permission(user, :post_report_moderation)
    end

    test "concurrent duplicate grants return the active permission" do
      user = user_fixture()

      grant_tasks =
        for _index <- 1..2 do
          Task.async(fn -> Accounts.grant_staff_permission(user, :post_report_moderation) end)
        end

      assert [
               {:ok, %{__struct__: StaffPermission, id: first_permission_id}},
               {:ok, %{__struct__: StaffPermission, id: second_permission_id}}
             ] = Enum.map(grant_tasks, &Task.await(&1, 5_000))

      assert first_permission_id == second_permission_id

      assert [%{__struct__: StaffPermission, id: ^first_permission_id}] =
               Accounts.list_active_staff_permissions(user)
    end

    test "revokes active staff permissions and excludes revoked grants from reads" do
      user = user_fixture()
      assert {:ok, permission} = Accounts.grant_staff_permission(user, :post_report_moderation)

      assert {:ok, revoked_permission} =
               Accounts.revoke_staff_permission(user, :post_report_moderation)

      assert revoked_permission.id == permission.id
      assert %DateTime{} = revoked_permission.revoked_at
      assert [] = Accounts.list_active_staff_permissions(user)

      assert {:error, :not_found} =
               Accounts.revoke_staff_permission(user, :post_report_moderation)
    end
  end

  describe "sudo_mode?/2" do
    test "validates the authenticated_at time" do
      now = DateTime.utc_now()

      assert Accounts.sudo_mode?(%User{authenticated_at: DateTime.utc_now()})
      assert Accounts.sudo_mode?(%User{authenticated_at: DateTime.add(now, -19, :minute)})
      refute Accounts.sudo_mode?(%User{authenticated_at: DateTime.add(now, -21, :minute)})

      # minute override
      refute Accounts.sudo_mode?(
               %User{authenticated_at: DateTime.add(now, -11, :minute)},
               -10
             )

      # not authenticated
      refute Accounts.sudo_mode?(%User{})
    end
  end

  describe "change_user_email/3" do
    test "returns a user changeset" do
      assert %Ecto.Changeset{} = changeset = Accounts.change_user_email(%User{})
      assert changeset.required == [:email]
    end
  end

  describe "deliver_user_update_email_instructions/3" do
    setup do
      %{user: user_fixture()}
    end

    test "sends token through notification via the public email verification wrapper", %{
      user: user
    } do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(user, "current@example.com", url)
        end)

      assert accounts_function_calls_local?(
               :deliver_user_update_email_instructions,
               3,
               :issue_email_verification_token,
               1
             )

      assert {:ok, %{id: id, raw_secret: raw_secret}} = Tokens.decode_serialized_value(token)
      assert user_token = Repo.get_by(UserToken, id: id)
      assert user_token.secret_hash == Tokens.secret_hash(raw_secret)
      assert user_token.user_id == user.id
      assert user_token.sent_to == user.email
      assert user_token.context == :email_verification_token
    end
  end

  describe "update_user_email/2" do
    setup do
      user = unconfirmed_user_fixture()
      email = unique_user_email()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email, url)
        end)

      %{user: user, token: token, email: email}
    end

    test "updates the email with a valid token", %{user: user, token: token, email: email} do
      assert {:ok, %{email: ^email}} = Accounts.update_user_email(user, token)
      changed_user = Accounts.get_user!(user.id)
      assert changed_user.email != user.email
      assert changed_user.email == email
      refute Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email with invalid token", %{user: user} do
      assert Accounts.update_user_email(user, "oops") ==
               {:error, :transaction_aborted}

      assert Accounts.get_user!(user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email if user email changed", %{user: user, token: token} do
      assert Accounts.update_user_email(%{user | email: "current@example.com"}, token) ==
               {:error, :transaction_aborted}

      assert Accounts.get_user!(user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email if token expired", %{user: user, token: token} do
      {1, nil} =
        Repo.update_all(UserToken, set: [inserted_at: ~U[2020-01-01 00:00:00.000000Z]])

      assert Accounts.update_user_email(user, token) ==
               {:error, :transaction_aborted}

      assert Accounts.get_user!(user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end
  end

  describe "change_user_password/3" do
    test "returns a user changeset" do
      assert %Ecto.Changeset{} = changeset = Accounts.change_user_password(%User{})
      assert changeset.required == [:password]
    end

    test "allows fields to be set" do
      changeset =
        Accounts.change_user_password(
          %User{},
          %{
            "password" => "new valid password"
          },
          hash_password: false
        )

      assert changeset.valid?
      assert get_change(changeset, :password) == "new valid password"
      assert is_nil(get_change(changeset, :hashed_password))
    end
  end

  describe "update_user_password/2" do
    setup do
      %{user: user_fixture()}
    end

    test "validates password", %{user: user} do
      {:error, changeset} =
        Accounts.update_user_password(user, %{
          password: "not valid",
          password_confirmation: "another"
        })

      assert %{
               password: ["should be at least 12 character(s)"],
               password_confirmation: ["does not match password"]
             } = errors_on(changeset)
    end

    test "validates maximum values for password for security", %{user: user} do
      too_long = String.duplicate("db", 100)

      {:error, changeset} =
        Accounts.update_user_password(user, %{password: too_long})

      assert "should be at most 72 character(s)" in errors_on(changeset).password
    end

    test "updates the password", %{user: user} do
      {:ok, {user, expired_tokens}} =
        Accounts.update_user_password(user, %{
          password: "new valid password"
        })

      assert expired_tokens == []
      assert is_nil(user.password)
      assert Accounts.get_user_by_email_and_password(user.email, "new valid password")
    end

    test "deletes all tokens for the given user", %{user: user} do
      _ = Accounts.generate_user_session_token(user)

      {:ok, {_, _}} =
        Accounts.update_user_password(user, %{
          password: "new valid password"
        })

      refute Repo.get_by(UserToken, user_id: user.id)
    end
  end

  describe "generate_user_session_token/1" do
    setup do
      %{user: user_fixture()}
    end

    test "generates a token", %{user: user} do
      token = Accounts.generate_user_session_token(user)
      assert {:ok, %{id: id, raw_secret: raw_secret}} = Tokens.decode_serialized_value(token)
      assert user_token = Repo.get_by(UserToken, id: id)
      assert_uuid_v7!(id)
      assert user_token.secret_hash == Tokens.secret_hash(raw_secret)
      assert user_token.context == :access_token
      assert user_token.authenticated_at != nil

      # Creating the same token for another user should fail
      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(%UserToken{
          secret_hash: user_token.secret_hash,
          user_id: user_fixture().id,
          context: :access_token
        })
      end
    end

    test "duplicates the authenticated_at of given user in new token", %{user: user} do
      user = %{user | authenticated_at: DateTime.add(DateTime.utc_now(), -3600)}
      token = Accounts.generate_user_session_token(user)
      assert {:ok, %{id: id}} = Tokens.decode_serialized_value(token)
      assert user_token = Repo.get_by(UserToken, id: id)
      assert user_token.authenticated_at == user.authenticated_at
      assert DateTime.compare(user_token.inserted_at, user.authenticated_at) == :gt
    end
  end

  describe "get_user_by_session_token/1" do
    setup do
      user = user_fixture()
      token = Accounts.generate_user_session_token(user)
      %{user: user, token: token}
    end

    test "returns user by token", %{user: user, token: token} do
      assert {session_user, token_inserted_at} = Accounts.get_user_by_session_token(token)
      assert session_user.id == user.id
      assert session_user.authenticated_at != nil
      assert token_inserted_at != nil
    end

    test "does not return user for invalid token" do
      refute Accounts.get_user_by_session_token("oops")
    end

    test "does not return user for expired token", %{token: token} do
      dt = ~U[2020-01-01 00:00:00.000000Z]
      {1, nil} = Repo.update_all(UserToken, set: [inserted_at: dt, authenticated_at: dt])
      refute Accounts.get_user_by_session_token(token)
    end

    test "does not return suspended users", %{user: user, token: token} do
      assert {:ok, _suspended_user} = Accounts.suspend_user(user)

      refute Accounts.get_user_by_session_token(token)
    end
  end

  describe "get_user_by_magic_link_token/1" do
    setup do
      user = user_fixture()
      {encoded_token, _hashed_token} = generate_user_magic_link_token(user)
      %{user: user, token: encoded_token}
    end

    test "returns user by token", %{user: user, token: token} do
      assert session_user = Accounts.get_user_by_magic_link_token(token)
      assert session_user.id == user.id
    end

    test "does not return user for invalid token" do
      refute Accounts.get_user_by_magic_link_token("oops")
    end

    test "does not return user for expired token", %{token: token} do
      {1, nil} =
        Repo.update_all(UserToken, set: [inserted_at: ~U[2020-01-01 00:00:00.000000Z]])

      refute Accounts.get_user_by_magic_link_token(token)
    end

    test "does not return suspended users", %{user: user, token: token} do
      assert {:ok, _suspended_user} = Accounts.suspend_user(user)

      refute Accounts.get_user_by_magic_link_token(token)
    end
  end

  describe "get_user_by_password_reset_token/1" do
    setup do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_password_reset_token(user)
      %{user: user, token: token}
    end

    test "returns user by token", %{user: user, token: token} do
      assert reset_user = Accounts.get_user_by_password_reset_token(token)
      assert reset_user.id == user.id
    end

    test "does not return user for invalid token" do
      refute Accounts.get_user_by_password_reset_token("oops")
    end

    test "does not return user for expired token", %{token: token} do
      {1, nil} =
        Repo.update_all(UserToken, set: [inserted_at: ~U[2020-01-01 00:00:00.000000Z]])

      refute Accounts.get_user_by_password_reset_token(token)
    end

    test "does not return suspended users", %{user: user, token: token} do
      assert {:ok, _suspended_user} = Accounts.suspend_user(user)

      refute Accounts.get_user_by_password_reset_token(token)
    end
  end

  describe "login_user_by_magic_link/1" do
    test "confirms user and expires tokens" do
      user = unconfirmed_user_fixture()
      refute user.confirmed_at
      {encoded_token, hashed_token} = generate_user_magic_link_token(user)

      assert {:ok, {user, [%{secret_hash: ^hashed_token}]}} =
               Accounts.login_user_by_magic_link(encoded_token)

      assert user.confirmed_at

      confirmed_user =
        Accounts.get_user!(user.id)
        |> Repo.preload(user_email_addresses: :email_address)

      assert [%{verified_at: %DateTime{}}] = confirmed_user.user_email_addresses
    end

    test "returns user and (deleted) token for confirmed user" do
      user = user_fixture()
      assert user.confirmed_at
      {encoded_token, _hashed_token} = generate_user_magic_link_token(user)
      assert {:ok, {^user, []}} = Accounts.login_user_by_magic_link(encoded_token)
      # one time use only
      assert {:error, :not_found} = Accounts.login_user_by_magic_link(encoded_token)
    end

    test "raises when unconfirmed user has password set" do
      user = unconfirmed_user_fixture()

      {1, nil} =
        Repo.update_all(from(u in User, where: u.id == ^user.id),
          set: [hashed_password: "hashed"]
        )

      {encoded_token, _hashed_token} = generate_user_magic_link_token(user)

      assert_raise RuntimeError, ~r/magic link log in is not allowed/, fn ->
        Accounts.login_user_by_magic_link(encoded_token)
      end
    end
  end

  describe "reset_user_password/2" do
    test "resets the password from a valid reset token and consumes all tokens" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_password_reset_token(user)

      assert {:ok, {updated_user, expired_tokens}} =
               Accounts.reset_user_password(token, %{password: "a brand new password"})

      assert updated_user.id == user.id
      assert Enum.any?(expired_tokens, &(&1.context == :password_reset_token))

      assert Accounts.get_user_by_email_and_password(user.email, "a brand new password")

      assert {:error, :not_found} =
               Accounts.reset_user_password(token, %{password: "another password"})
    end

    test "returns not_found for invalid tokens" do
      assert {:error, :not_found} =
               Accounts.reset_user_password("invalid-token", %{password: "a brand new password"})
    end

    test "returns changeset errors for invalid password attrs" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_password_reset_token(user)

      assert {:error, %Ecto.Changeset{} = changeset} =
               Accounts.reset_user_password(token, %{
                 password: "too short",
                 password_confirmation: "mismatch"
               })

      assert "should be at least 12 character(s)" in errors_on(changeset).password
      assert "does not match password" in errors_on(changeset).password_confirmation
    end
  end

  describe "delete_user_session_token/1" do
    test "deletes the token" do
      user = user_fixture()
      token = Accounts.generate_user_session_token(user)
      assert Accounts.delete_user_session_token(token) == :ok
      refute Accounts.get_user_by_session_token(token)
    end
  end

  describe "deliver_user_reset_password_instructions/2" do
    setup do
      %{user: user_fixture()}
    end

    test "sends reset token through notification via the public reset wrapper", %{user: user} do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_reset_password_instructions(user, url)
        end)

      assert accounts_function_calls_local?(
               :deliver_user_reset_password_instructions,
               2,
               :issue_password_reset_token,
               1
             )

      assert {:ok, %{id: id, raw_secret: raw_secret}} = Tokens.decode_serialized_value(token)
      assert user_token = Repo.get_by(UserToken, id: id)
      assert user_token.secret_hash == Tokens.secret_hash(raw_secret)
      assert user_token.user_id == user.id
      assert user_token.sent_to == user.email
      assert user_token.context == :password_reset_token
    end
  end

  describe "deliver_login_instructions/2" do
    setup do
      %{user: unconfirmed_user_fixture()}
    end

    test "sends token through notification via the public magic link wrapper", %{user: user} do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_login_instructions(user, url)
        end)

      assert accounts_function_calls_local?(
               :deliver_login_instructions,
               2,
               :issue_magic_link_token,
               1
             )

      assert {:ok, %{id: id, raw_secret: raw_secret}} = Tokens.decode_serialized_value(token)
      assert user_token = Repo.get_by(UserToken, id: id)
      assert user_token.secret_hash == Tokens.secret_hash(raw_secret)
      assert user_token.user_id == user.id
      assert user_token.sent_to == user.email
      assert user_token.context == :email_magic_link_token
    end

    test "does not issue a token for unconfirmed users who already set a password" do
      password = valid_user_password()

      assert {:ok, %{user: user}} =
               Accounts.sign_up_with_password(%{
                 email: "blocked-magic-link@example.com",
                 password: password,
                 password_confirmation: password
               })

      assert {:error, :magic_link_not_allowed} =
               Accounts.deliver_login_instructions(user, &"https://livecanvas.invalid/#{&1}")

      refute Repo.get_by(UserToken, user_id: user.id, context: :email_magic_link_token)
    end
  end

  describe "deliver_contact_invite_instructions/3" do
    setup do
      %{user: user_fixture()}
    end

    test "sends invite token through notifier via the public contact invite wrapper", %{
      user: user
    } do
      contact_entry = upsert_contact_entry(user, emails: ["friend@example.com"])

      token =
        extract_user_token(fn url ->
          Accounts.deliver_contact_invite_instructions(user, contact_entry.id, url)
        end)

      assert {:ok, %{id: id, raw_secret: raw_secret}} = Tokens.decode_serialized_value(token)
      assert user_token = Repo.get_by(UserToken, id: id)
      assert user_token.secret_hash == Tokens.secret_hash(raw_secret)
      assert user_token.user_id == user.id
      assert user_token.sent_to == "friend@example.com"
      assert user_token.context == :contact_invite_fragment_token
    end

    test "suppresses a contact row after it becomes matched" do
      user = user_fixture()
      recipient_email = "domain-matched-contact@example.com"
      contact_entry = upsert_contact_entry(user, emails: [recipient_email])
      _recipient = user_fixture(email: recipient_email)

      assert {:ok, :suppressed} =
               Accounts.deliver_contact_invite_instructions(
                 user,
                 contact_entry.id,
                 &"https://app.livecanvas.example/invites#token=#{&1}"
               )

      refute Repo.get_by(
               UserToken,
               user_id: user.id,
               context: :contact_invite_fragment_token
             )
    end

    test "does not advertise or deliver to a malformed imported email" do
      user = user_fixture()
      contact_entry = upsert_contact_entry(user, emails: ["not-an-email"])

      assert [%{invite_recipient: nil}] = Accounts.list_user_contact_matches(user)

      assert {:error, :invalid_contact_match} =
               Accounts.deliver_contact_invite_instructions(
                 user,
                 contact_entry.id,
                 &"https://app.livecanvas.example/invites#token=#{&1}"
               )

      refute Repo.get_by(UserToken,
               user_id: user.id,
               context: :contact_invite_fragment_token
             )
    end
  end

  describe "consume_contact_invite/2" do
    test "rejects a stale deleted viewer without consuming the token" do
      inviter = user_fixture()
      recipient = user_fixture(email: "deleted-invite-recipient@example.com")
      {token, persisted} = issue_contact_invite(inviter, recipient.email)

      Repo.delete!(recipient)

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, token)

      assert Repo.get(UserToken, persisted.id)
    end

    test "rejects malformed, tampered, wrong-context, and expired tokens" do
      inviter = user_fixture()
      recipient = user_fixture(email: "invite-recipient@example.com")

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, "malformed")

      {token, persisted} = issue_contact_invite(inviter, recipient.email)
      assert {:ok, %{id: token_id}} = Tokens.decode_serialized_value(token)
      tampered = Tokens.encode_serialized_value(token_id, "tampered-secret")

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, tampered)

      assert Repo.get(UserToken, persisted.id)

      assert {:ok, %{token: wrong_context_token}} =
               Accounts.issue_password_reset_token(recipient)

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, wrong_context_token)

      {expired_token, expired_persisted} = issue_contact_invite(inviter, recipient.email)

      Repo.update_all(
        from(user_token in UserToken, where: user_token.id == ^expired_persisted.id),
        set: [inserted_at: DateTime.add(DateTime.utc_now(), -8, :day)]
      )

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, expired_token)
    end

    test "consumes a verified recipient token once without storing raw token material" do
      inviter = user_fixture()
      recipient = user_fixture(email: "verified-invite-recipient@example.com")
      {token, persisted} = issue_contact_invite(inviter, String.upcase(recipient.email))

      assert {:ok, %{__struct__: ContactInviteConversion} = conversion} =
               Accounts.consume_contact_invite(recipient, token)

      assert conversion.invite_token_id == persisted.id
      assert conversion.inviter_id == inviter.id
      assert conversion.recipient_user_id == recipient.id
      assert conversion.invite_secret_hash == persisted.secret_hash
      assert %DateTime{} = conversion.consumed_at
      assert is_binary(conversion.entropy_id)
      refute Repo.get(UserToken, persisted.id)
    end

    test "locks the verified recipient email ownership row through conversion commit" do
      inviter = user_fixture()
      recipient = user_fixture(email: "locked-invite-recipient@example.com")
      {token, _persisted} = issue_contact_invite(inviter, recipient.email)

      {result, queries} =
        capture_repo_queries(fn -> Accounts.consume_contact_invite(recipient, token) end)

      assert {:ok, %ContactInviteConversion{}} = result

      assert Enum.any?(queries, fn query ->
               query =~ ~s(FROM "user_email_addresses") and query =~ "FOR UPDATE"
             end)
    end

    test "password signup consumption atomically verifies only the matching email and confirms the user" do
      inviter = user_fixture()
      password = valid_user_password()

      assert {:ok, %{user: recipient}} =
               Accounts.sign_up_with_password(%{
                 email: "password-invite-recipient@example.com",
                 password: password,
                 password_confirmation: password
               })

      assert {:ok, other_join} =
               Accounts.attach_user_email_address(recipient, "other-address@example.com")

      {token, _persisted} = issue_contact_invite(inviter, String.upcase(recipient.email))

      assert {:ok, %{recipient_user_id: recipient_id}} =
               Accounts.consume_contact_invite(recipient, token)

      assert recipient_id == recipient.id

      reloaded =
        Accounts.get_user!(recipient.id)
        |> Repo.preload(user_email_addresses: :email_address)

      assert %DateTime{} = reloaded.confirmed_at

      matching_join =
        Enum.find(reloaded.user_email_addresses, fn join ->
          join.email_address.normalized_email == recipient.email
        end)

      assert %DateTime{} = matching_join.verified_at
      assert is_nil(Repo.get!(UserEmailAddress, other_join.id).verified_at)
    end

    test "rejects a different recipient without changing verification" do
      inviter = user_fixture()
      password = valid_user_password()

      assert {:ok, %{user: recipient}} =
               Accounts.sign_up_with_password(%{
                 email: "nonmatching-invite-recipient@example.com",
                 password: password,
                 password_confirmation: password
               })

      {token, persisted} = issue_contact_invite(inviter, "someone-else@example.com")

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, token)

      reloaded =
        Accounts.get_user!(recipient.id)
        |> Repo.preload(:user_email_addresses)

      assert is_nil(reloaded.confirmed_at)
      assert Enum.all?(reloaded.user_email_addresses, &is_nil(&1.verified_at))
      assert Repo.get(UserToken, persisted.id)
    end

    test "returns the exact conversion to the same viewer and secret during the handoff window" do
      inviter = user_fixture()
      recipient = user_fixture(email: "idempotent-invite-recipient@example.com")
      {token, _persisted} = issue_contact_invite(inviter, recipient.email)

      assert {:ok, first_conversion} = Accounts.consume_contact_invite(recipient, token)
      assert {:ok, second_conversion} = Accounts.consume_contact_invite(recipient, token)
      assert second_conversion.id == first_conversion.id
    end

    test "rejects conversion replay for a wrong secret, different viewer, or expired handoff" do
      inviter = user_fixture()
      recipient = user_fixture(email: "replay-invite-recipient@example.com")
      other_user = user_fixture()
      {token, _persisted} = issue_contact_invite(inviter, recipient.email)

      assert {:ok, conversion} = Accounts.consume_contact_invite(recipient, token)
      assert {:ok, %{id: token_id}} = Tokens.decode_serialized_value(token)

      wrong_secret_token = Tokens.encode_serialized_value(token_id, "wrong-secret")

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, wrong_secret_token)

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(other_user, token)

      Repo.update_all(
        from(candidate in ContactInviteConversion, where: candidate.id == ^conversion.id),
        set: [consumed_at: DateTime.add(DateTime.utc_now(), -61, :minute)]
      )

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, token)
    end

    test "rolls back email verification when conversion insertion cannot complete" do
      inviter = user_fixture()
      password = valid_user_password()

      assert {:ok, %{user: recipient}} =
               Accounts.sign_up_with_password(%{
                 email: "rollback-invite-recipient@example.com",
                 password: password,
                 password_confirmation: password
               })

      {token, persisted} = issue_contact_invite(inviter, recipient.email)

      assert {:ok, _existing_conversion} =
               Repo.insert(
                 struct(ContactInviteConversion,
                   invite_token_id: persisted.id,
                   invite_secret_hash: persisted.secret_hash,
                   inviter_id: inviter.id,
                   recipient_user_id: recipient.id,
                   consumed_at: DateTime.utc_now()
                 )
               )

      assert {:error, :invalid_contact_invite} =
               Accounts.consume_contact_invite(recipient, token)

      reloaded =
        Accounts.get_user!(recipient.id)
        |> Repo.preload(:user_email_addresses)

      assert is_nil(reloaded.confirmed_at)
      assert Enum.all?(reloaded.user_email_addresses, &is_nil(&1.verified_at))
      assert Repo.get(UserToken, persisted.id)
    end
  end

  describe "deliver_phone_verification_instructions/2" do
    setup do
      original_level = Logger.level()
      Logger.configure(level: :info)
      on_exit(fn -> Logger.configure(level: original_level) end)

      %{user: user_fixture()}
    end

    test "issues a phone verification token and logs SMS via the public wrapper", %{user: user} do
      {:ok, _join} = Accounts.attach_user_phone_number(user, "(650) 253-0000")

      log =
        capture_log([level: :info], fn ->
          assert :ok = Accounts.deliver_phone_verification_instructions(user, "650-253-0000")
        end)

      assert accounts_function_calls_local?(
               :deliver_phone_verification_instructions,
               2,
               :issue_phone_verification_token,
               2
             )

      assert log =~ "[fake_sms]"
      assert log =~ "+16502530000"

      assert user_token =
               Repo.get_by(UserToken, user_id: user.id, context: :phone_verification_token)

      assert user_token.sent_to == "+16502530000"
    end
  end

  describe "inspect/2 for the User module" do
    test "does not include password" do
      refute inspect(%User{password: "123456"}) =~ "password: \"123456\""
    end
  end

  defp assert_uuid_v7!(uuid) when is_binary(uuid) do
    assert String.at(uuid, 14) == "7"
  end

  defp issue_contact_invite(inviter, recipient_email) do
    assert {:ok, %{token: token, user_token: persisted}} =
             Accounts.issue_contact_invite_token(inviter, recipient_email)

    {token, persisted}
  end

  defp accounts_function_calls_local?(caller_name, caller_arity, callee_name, callee_arity) do
    beam_path = :code.which(Accounts)

    with {:ok, {_, [{:abstract_code, {:raw_abstract_v1, forms}}]}} <-
           :beam_lib.chunks(beam_path, [:abstract_code]),
         {:function, _, ^caller_name, ^caller_arity, _} = function_form <-
           Enum.find(forms, &match?({:function, _, ^caller_name, ^caller_arity, _}, &1)) do
      abstract_form_calls_local?(function_form, callee_name, callee_arity)
    else
      _ -> false
    end
  end

  defp abstract_form_calls_local?(
         {:call, _, {:atom, _, found_name}, args},
         callee_name,
         callee_arity
       )
       when found_name == callee_name and length(args) == callee_arity,
       do: true

  defp abstract_form_calls_local?(term, callee_name, callee_arity) when is_tuple(term) do
    term
    |> Tuple.to_list()
    |> Enum.any?(&abstract_form_calls_local?(&1, callee_name, callee_arity))
  end

  defp abstract_form_calls_local?(terms, callee_name, callee_arity) when is_list(terms) do
    Enum.any?(terms, &abstract_form_calls_local?(&1, callee_name, callee_arity))
  end

  defp abstract_form_calls_local?(_, _, _), do: false
end
