defmodule LiveCanvas.Repo.Migrations.AddUserRoles do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:users) do
      add :role, :string, null: false, default: "user"
    end

    create constraint(:users, :users_role_check, check: "role IN ('user', 'moderator', 'admin')")

    create index(:users, [:role])
  end
end
