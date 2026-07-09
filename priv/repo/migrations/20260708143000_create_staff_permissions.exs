defmodule LiveCanvas.Repo.Migrations.CreateStaffPermissions do
  use Ecto.Migration

  def change do
    create table(:staff_permissions) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :permission, :string, null: false
      add :granted_at, :utc_datetime_usec, null: false
      add :revoked_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create constraint(:staff_permissions, :staff_permissions_permission_check,
             check: "permission IN ('post_report_moderation')"
           )

    create index(:staff_permissions, [:user_id, :granted_at, :id],
             where: "revoked_at IS NULL",
             name: :staff_permissions_active_user_order_index
           )

    create unique_index(:staff_permissions, [:entropy_id])

    create unique_index(:staff_permissions, [:user_id, :permission],
             where: "revoked_at IS NULL",
             name: :staff_permissions_active_user_permission_index
           )
  end
end
