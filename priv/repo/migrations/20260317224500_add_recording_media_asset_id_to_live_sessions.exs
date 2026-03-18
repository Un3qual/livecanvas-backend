defmodule LiveCanvas.Repo.Migrations.AddRecordingMediaAssetIdToLiveSessions do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:live_sessions) do
      add :recording_media_asset_id, references(:media_assets, on_delete: :nilify_all)
    end

    create index(:live_sessions, [:recording_media_asset_id])
  end
end
