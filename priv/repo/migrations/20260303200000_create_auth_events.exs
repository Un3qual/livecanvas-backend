defmodule LiveCanvas.Repo.Migrations.CreateAuthEvents do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  alias LCSchemas.Accounts.AuthEventType

  def up do
    AuthEventType.create_type()

    create table(:auth_events) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :user_id, references(:users, on_delete: :nilify_all)
      add :event_type, :auth_event_type, null: false
      add :metadata, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:auth_events, [:user_id])
    create index(:auth_events, [:event_type])
    create index(:auth_events, [:inserted_at])
    create unique_index(:auth_events, [:entropy_id])
  end

  def down do
    drop table(:auth_events)

    flush()
    AuthEventType.drop_type()
  end
end
