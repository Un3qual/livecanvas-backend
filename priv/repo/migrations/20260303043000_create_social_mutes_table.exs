defmodule LiveCanvas.Repo.Migrations.CreateSocialMutesTable do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:mutes) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :muter_id, references(:users, on_delete: :delete_all), null: false
      add :muted_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:mutes, [:muter_id])
    create index(:mutes, [:muted_id])
    create unique_index(:mutes, [:entropy_id])
    create unique_index(:mutes, [:muter_id, :muted_id])
  end
end
