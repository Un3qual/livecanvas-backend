defmodule LiveCanvas.Repo.Migrations.CreateLiveTables do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:live_sessions) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :host_id, references(:users, on_delete: :delete_all), null: false
      add :status, :string, null: false, default: "starting"
      add :visibility, :string, null: false, default: "followers"
      add :started_at, :utc_datetime_usec
      add :ended_at, :utc_datetime_usec
      add :ended_reason, :string

      timestamps(type: :utc_datetime_usec)
    end

    create index(:live_sessions, [:host_id])
    create index(:live_sessions, [:status])
    create unique_index(:live_sessions, [:entropy_id])

    create table(:live_participants) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :role, :string, null: false
      add :joined_at, :utc_datetime_usec, null: false
      add :left_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:live_participants, [:live_session_id])
    create index(:live_participants, [:user_id])
    create unique_index(:live_participants, [:entropy_id])
    create unique_index(:live_participants, [:live_session_id, :user_id])
  end
end
