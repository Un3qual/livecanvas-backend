defmodule LCSchemas.IDConventionsTest do
  use LC.DataCase, async: true

  alias LCSchemas.Accounts.{
    EmailAddress,
    User,
    UserContactEntry,
    UserEmailAddress,
    UserToken
  }

  describe "schema id conventions" do
    test "relational user schema keeps bigint id and adds entropy_id" do
      assert :id == User.__schema__(:type, :id)
      assert :entropy_id in User.__schema__(:fields)
    end

    test "join schema keeps bigint id and adds entropy_id" do
      assert :id == UserEmailAddress.__schema__(:type, :id)
      assert :entropy_id in UserEmailAddress.__schema__(:fields)
    end

    test "user token remains uuid-primary-key exception without entropy_id" do
      assert :binary_id == UserToken.__schema__(:type, :id)
      refute :entropy_id in UserToken.__schema__(:fields)
    end
  end

  describe "database-generated values" do
    test "user rows load with entropy_id" do
      user = Repo.insert!(%User{})
      reloaded_user = Repo.get!(User, user.id)

      assert is_binary(reloaded_user.entropy_id)
    end

    test "email address rows load with entropy_id" do
      email_address =
        Repo.insert!(%EmailAddress{
          normalized_email: "entropy-#{System.unique_integer([:positive])}@example.com"
        })

      assert is_binary(email_address.entropy_id)
    end

    test "user contact entry rows load with entropy_id" do
      user_id = insert_user_row!()

      user_contact_entry =
        Repo.insert!(%UserContactEntry{
          user_id: user_id,
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Entropy Contact"
        })

      assert is_binary(user_contact_entry.entropy_id)
    end

    test "user token rows insert without explicitly supplying id" do
      user_id = insert_user_row!()

      user_token =
        Repo.insert!(%UserToken{
          user_id: user_id,
          secret_hash: :crypto.strong_rand_bytes(32),
          context: :access_token
        })

      assert is_binary(user_token.id)
    end

    test "entropy_id rejects duplicates once the uniqueness constraint exists" do
      duplicate_entropy_id = Ecto.UUID.generate()

      Repo.insert!(%EmailAddress{
        normalized_email: "entropy-#{System.unique_integer([:positive])}@example.com",
        entropy_id: duplicate_entropy_id
      })

      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(%EmailAddress{
          normalized_email: "entropy-#{System.unique_integer([:positive])}@example.com",
          entropy_id: duplicate_entropy_id
        })
      end
    end
  end

  defp insert_user_row! do
    %{rows: [[user_id]]} =
      Repo.query!("""
      INSERT INTO users (privacy_mode, inserted_at, updated_at)
      VALUES ('private', NOW(), NOW())
      RETURNING id
      """)

    user_id
  end
end
