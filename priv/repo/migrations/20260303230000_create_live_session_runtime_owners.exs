defmodule LiveCanvas.Repo.Migrations.CreateLiveSessionRuntimeOwners do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:live_session_runtime_owners) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :owner_node, :text, null: false
      add :lease_expires_at, :utc_datetime_usec, null: false
      add :heartbeat_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:live_session_runtime_owners, [:entropy_id])
    create unique_index(:live_session_runtime_owners, [:live_session_id])
    create index(:live_session_runtime_owners, [:owner_node])
    create index(:live_session_runtime_owners, [:lease_expires_at])
  end
end
