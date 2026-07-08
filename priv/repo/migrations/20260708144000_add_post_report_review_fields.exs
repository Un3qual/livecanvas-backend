defmodule LiveCanvas.Repo.Migrations.AddPostReportReviewFields do
  use Ecto.Migration

  def change do
    alter table(:post_reports) do
      add :reviewed_by_id, references(:users, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime_usec
      add :decision_note, :text
    end

    create index(:post_reports, [:reviewed_by_id])

    create index(:post_reports, [:status, :inserted_at, :id],
             name: :post_reports_status_inserted_id_index
           )

    create index(
             :post_reports,
             [
               "(CASE status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 WHEN 'dismissed' THEN 2 WHEN 'actioned' THEN 3 ELSE 4 END)",
               :inserted_at,
               :id
             ],
             name: :post_reports_moderation_queue_order_index
           )
  end
end
