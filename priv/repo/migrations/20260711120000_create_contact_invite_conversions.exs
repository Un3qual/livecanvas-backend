defmodule LiveCanvas.Repo.Migrations.CreateContactInviteConversions do
  use Ecto.Migration

  def up do
    create table(:contact_invite_conversions) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :invite_token_id, :uuid, null: false
      add :invite_secret_hash, :binary, null: false
      add :inviter_id, references(:users, on_delete: :nilify_all)
      add :recipient_user_id, references(:users, on_delete: :nilify_all)
      add :consumed_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:contact_invite_conversions, [:entropy_id])
    create unique_index(:contact_invite_conversions, [:invite_token_id])

    # Tokens issued before the fragment-based handoff contract used a non-routable
    # placeholder URL, so retaining them would create ghost-valid credentials.
    execute("DELETE FROM users_tokens WHERE context = 'contact_invite_token'")
  end

  def down do
    drop table(:contact_invite_conversions)
  end
end
