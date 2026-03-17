defmodule LCSchemas.Accounts.UserPasskeyTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LCSchemas.Accounts.UserPasskey

  describe "schema shape" do
    test "keeps bigint ids, entropy_id, and passkey-specific fields" do
      assert :id == UserPasskey.__schema__(:type, :id)
      assert :entropy_id in UserPasskey.__schema__(:fields)
      assert :credential_id in UserPasskey.__schema__(:fields)
      assert :public_key in UserPasskey.__schema__(:fields)
      assert :sign_count in UserPasskey.__schema__(:fields)
      assert :transports in UserPasskey.__schema__(:fields)
      assert :last_used_at in UserPasskey.__schema__(:fields)
      assert :user_id in UserPasskey.__schema__(:fields)
      assert :user_identity_id in UserPasskey.__schema__(:fields)
      assert :utc_datetime_usec == UserPasskey.__schema__(:type, :last_used_at)
    end
  end

  describe "database behavior" do
    test "loads entropy_id and enforces one row per credential" do
      schema = UserPasskey
      user = user_fixture()
      user_identity = attach_user_identity(user, :passkey_provider, "schema-passkey-credential")

      passkey =
        Repo.insert!(
          struct!(schema, %{
            user_id: user.id,
            user_identity_id: user_identity.id,
            credential_id: "schema-passkey-credential",
            public_key: "schema-public-key",
            sign_count: 0,
            transports: ["internal"],
            last_used_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
          })
        )

      assert is_binary(passkey.entropy_id)

      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(
          struct!(schema, %{
            user_id: user.id,
            user_identity_id: user_identity.id,
            credential_id: "schema-passkey-credential",
            public_key: "other-public-key",
            sign_count: 1,
            transports: ["usb"]
          })
        )
      end
    end
  end
end
