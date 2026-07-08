defmodule LiveCanvas.Repo.Migrations.AddPostReportReviewFields do
  use Ecto.Migration

  def change do
    alter table(:post_reports) do
      add :reviewed_by_id, references(:users, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime_usec
      add :decision_note, :text
    end

    create index(:post_reports, [:reviewed_by_id])
    create index(:post_reports, [:status, :inserted_at, :id])
  end
end
