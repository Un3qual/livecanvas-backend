defmodule LiveCanvas.Repo.Migrations.AddUsersSuspendedAt do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:users) do
      add :suspended_at, :utc_datetime_usec
    end

    create index(:users, [:suspended_at])
  end
end
