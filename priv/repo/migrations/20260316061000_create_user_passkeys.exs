defmodule LiveCanvas.Repo.Migrations.CreateUserPasskeys do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def up do
    create table(:user_passkeys) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :user_identity_id, references(:user_identities, on_delete: :delete_all), null: false
      add :credential_id, :text, null: false
      add :public_key, :binary, null: false
      add :sign_count, :bigint, null: false, default: 0
      add :transports, {:array, :text}, null: false, default: []
      add :last_used_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_passkeys, [:user_id])
    create unique_index(:user_passkeys, [:entropy_id])
    create unique_index(:user_passkeys, [:user_identity_id])
    create unique_index(:user_passkeys, [:credential_id])
  end

  def down do
    drop table(:user_passkeys)
  end
end
