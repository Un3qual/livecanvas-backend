defmodule LiveCanvas.Repo.Migrations.CreateWebhookEventsAndAsyncJobs do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:webhook_events) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :provider, :string, null: false
      add :external_event_id, :string, null: false
      add :event_type, :string
      add :status, :string, null: false, default: "received"
      add :payload, :map, null: false, default: %{}
      add :received_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :processed_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:webhook_events, [:entropy_id])

    create unique_index(:webhook_events, [:provider, :external_event_id],
             name: :webhook_events_provider_external_event_id_index
           )

    create index(:webhook_events, [:status, :received_at])

    create table(:async_jobs) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :kind, :string, null: false
      add :dedupe_key, :string
      add :status, :string, null: false, default: "pending"
      add :payload, :map, null: false, default: %{}
      add :attempts, :integer, null: false, default: 0
      add :max_attempts, :integer, null: false, default: 10
      add :scheduled_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :locked_at, :utc_datetime_usec
      add :completed_at, :utc_datetime_usec
      add :last_error, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:async_jobs, [:entropy_id])

    create unique_index(:async_jobs, [:dedupe_key],
             where: "dedupe_key IS NOT NULL",
             name: :async_jobs_dedupe_key_index
           )

    create index(:async_jobs, [:kind, :status, :scheduled_at], name: :async_jobs_claim_index)
    create constraint(:async_jobs, :async_jobs_attempts_nonnegative, check: "attempts >= 0")
    create constraint(:async_jobs, :async_jobs_max_attempts_positive, check: "max_attempts > 0")
  end
end
