defmodule LiveCanvas.Repo.Migrations.RebuildAccountsIdentityTables do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  alias LCSchemas.Accounts.{UserIdentityProvider, UserTokenContext}

  def up do
    execute "CREATE EXTENSION IF NOT EXISTS citext", ""
    execute "CREATE EXTENSION IF NOT EXISTS pgcrypto", ""
    UserIdentityProvider.create_type()
    UserTokenContext.create_type()

    create table(:email_addresses) do
      add :normalized_email, :citext, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:email_addresses, [:normalized_email])

    create table(:phone_numbers) do
      add :normalized_e164, :text, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:phone_numbers, [:normalized_e164])

    create table(:user_email_addresses) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :email_address_id, references(:email_addresses, on_delete: :delete_all), null: false
      add :verified_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_email_addresses, [:user_id])
    create index(:user_email_addresses, [:email_address_id])
    create unique_index(:user_email_addresses, [:user_id, :email_address_id])

    create table(:user_phone_numbers) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :phone_number_id, references(:phone_numbers, on_delete: :delete_all), null: false
      add :verified_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_phone_numbers, [:user_id])
    create index(:user_phone_numbers, [:phone_number_id])
    create unique_index(:user_phone_numbers, [:user_id, :phone_number_id])

    create table(:user_identities) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :provider, :user_identity_provider, null: false
      add :provider_uid, :binary, null: false
      add :provider_data, :map, null: false, default: %{}
      add :encrypted_tokens, :binary
      add :last_used_at, :utc_datetime_usec
      add :revoked_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_identities, [:user_id])
    create unique_index(:user_identities, [:provider, :provider_uid])

    create table(:user_contact_entries) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :contact_name, :text
      add :birthday, :date
      add :contact_client_id, :binary, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_contact_entries, [:user_id])
    create unique_index(:user_contact_entries, [:user_id, :contact_client_id])

    create table(:user_contact_entry_email_addresses) do
      add :user_contact_entry_id, references(:user_contact_entries, on_delete: :delete_all),
        null: false

      add :email_address_id, references(:email_addresses, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_contact_entry_email_addresses, [:user_contact_entry_id])
    create index(:user_contact_entry_email_addresses, [:email_address_id])

    create unique_index(:user_contact_entry_email_addresses, [
             :user_contact_entry_id,
             :email_address_id
           ])

    create table(:user_contact_entry_phone_numbers) do
      add :user_contact_entry_id, references(:user_contact_entries, on_delete: :delete_all),
        null: false

      add :phone_number_id, references(:phone_numbers, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_contact_entry_phone_numbers, [:user_contact_entry_id])
    create index(:user_contact_entry_phone_numbers, [:phone_number_id])

    create unique_index(:user_contact_entry_phone_numbers, [
             :user_contact_entry_id,
             :phone_number_id
           ])

    flush()

    execute("""
    INSERT INTO email_addresses (normalized_email, inserted_at, updated_at)
    SELECT users.email, users.inserted_at, users.inserted_at
    FROM users
    """)

    execute("""
    INSERT INTO user_email_addresses (user_id, email_address_id, verified_at, inserted_at, updated_at)
    SELECT users.id, email_addresses.id, users.confirmed_at, users.inserted_at, users.inserted_at
    FROM users
    JOIN email_addresses ON email_addresses.normalized_email = users.email
    """)

    drop_if_exists index(:users, [:email])

    alter table(:users) do
      remove :email
    end

    rename table(:users_tokens), to: table(:users_tokens_legacy)

    drop_if_exists index(:users_tokens_legacy, [:user_id], name: "users_tokens_user_id_index")

    drop_if_exists index(:users_tokens_legacy, [:context, :token],
                     name: "users_tokens_context_token_index"
                   )

    create table(:users_tokens, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :secret_hash, :binary, null: false
      add :context, :user_token_context, null: false
      add :sent_to, :text
      add :authenticated_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:users_tokens, [:user_id])
    create unique_index(:users_tokens, [:context, :secret_hash])

    flush()

    execute("""
    INSERT INTO users_tokens (user_id, secret_hash, context, sent_to, authenticated_at, inserted_at)
    SELECT
      user_id,
      token,
      CASE
        WHEN context = 'session' THEN 'access_token'
        WHEN context = 'login' THEN 'email_magic_link_token'
        WHEN context LIKE 'change:%' THEN 'email_verification_token'
      END::user_token_context,
      sent_to,
      authenticated_at,
      inserted_at
    FROM users_tokens_legacy
    WHERE context IN ('session', 'login') OR context LIKE 'change:%'
    """)

    drop table(:users_tokens_legacy)
  end

  def down do
    rename table(:users_tokens), to: table(:users_tokens_v2)

    drop_if_exists index(:users_tokens_v2, [:user_id], name: "users_tokens_user_id_index")

    drop_if_exists index(:users_tokens_v2, [:context, :secret_hash],
                     name: "users_tokens_context_secret_hash_index"
                   )

    create table(:users_tokens) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :token, :binary, null: false
      add :context, :text, null: false
      add :sent_to, :text
      add :authenticated_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:users_tokens, [:user_id])
    create unique_index(:users_tokens, [:context, :token])

    flush()

    execute("""
    INSERT INTO users_tokens (user_id, token, context, sent_to, authenticated_at, inserted_at)
    SELECT
      user_id,
      secret_hash,
      CASE
        WHEN context::text = 'access_token' THEN 'session'
        WHEN context::text = 'email_magic_link_token' THEN 'login'
        WHEN context::text = 'email_verification_token' THEN 'change:' || COALESCE(sent_to, '')
        ELSE context::text
      END,
      sent_to,
      authenticated_at,
      inserted_at
    FROM users_tokens_v2
    """)

    drop table(:users_tokens_v2)

    alter table(:users) do
      add :email, :citext
    end

    execute("""
    UPDATE users
    SET email = email_addresses.normalized_email
    FROM user_email_addresses
    JOIN email_addresses ON email_addresses.id = user_email_addresses.email_address_id
    WHERE users.id = user_email_addresses.user_id
    """)

    execute "ALTER TABLE users ALTER COLUMN email SET NOT NULL", ""
    create unique_index(:users, [:email])

    drop table(:user_contact_entry_phone_numbers)
    drop table(:user_contact_entry_email_addresses)
    drop table(:user_contact_entries)
    drop table(:user_identities)
    drop table(:user_phone_numbers)
    drop table(:user_email_addresses)
    drop table(:phone_numbers)
    drop table(:email_addresses)

    UserTokenContext.drop_type()
    UserIdentityProvider.drop_type()
  end
end
