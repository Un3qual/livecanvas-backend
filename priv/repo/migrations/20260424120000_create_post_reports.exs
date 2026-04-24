defmodule LiveCanvas.Repo.Migrations.CreatePostReports do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:post_reports) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :reporter_id, references(:users, on_delete: :delete_all), null: false
      add :post_id, references(:posts, on_delete: :delete_all), null: false
      add :reason, :string, null: false
      add :details, :text
      add :status, :string, null: false, default: "open"

      timestamps(type: :utc_datetime_usec)
    end

    create constraint(:post_reports, :post_reports_reason_check,
             check:
               "reason IN ('spam', 'harassment', 'hate', 'violence', 'sexual_content', 'self_harm', 'illegal', 'other')"
           )

    create constraint(:post_reports, :post_reports_status_check,
             check: "status IN ('open', 'reviewed', 'dismissed', 'actioned')"
           )

    create index(:post_reports, [:reporter_id])
    create index(:post_reports, [:post_id])
    create index(:post_reports, [:status, :inserted_at])
    create unique_index(:post_reports, [:reporter_id, :post_id])
    create unique_index(:post_reports, [:entropy_id])
  end
end
