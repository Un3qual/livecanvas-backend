defmodule LiveCanvas.Repo.Migrations.CreateDataGovernanceRequests do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  alias LCSchemas.Infra.AccountDeletionRequestStatus
  alias LCSchemas.Infra.DataExportRequestStatus

  def up do
    DataExportRequestStatus.create_type()
    AccountDeletionRequestStatus.create_type()

    create table(:data_export_requests) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :user_id, references(:users, on_delete: :nilify_all)
      add :status, :data_export_request_status, null: false, default: "pending"
      add :format, :string, null: false, default: "json"
      add :requested_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :completed_at, :utc_datetime_usec
      add :failure_reason, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:data_export_requests, [:entropy_id])
    create index(:data_export_requests, [:user_id, :inserted_at])

    create table(:account_deletion_requests) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :user_id, references(:users, on_delete: :nilify_all)
      add :status, :account_deletion_request_status, null: false, default: "pending"
      add :requested_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :scheduled_purge_at, :utc_datetime_usec, null: false
      add :completed_at, :utc_datetime_usec
      add :failure_reason, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:account_deletion_requests, [:entropy_id])
    create index(:account_deletion_requests, [:user_id, :inserted_at])
  end

  def down do
    drop table(:account_deletion_requests)
    drop table(:data_export_requests)

    flush()
    AccountDeletionRequestStatus.drop_type()
    DataExportRequestStatus.drop_type()
  end
end
