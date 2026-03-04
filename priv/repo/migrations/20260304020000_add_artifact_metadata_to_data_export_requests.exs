defmodule LiveCanvas.Repo.Migrations.AddArtifactMetadataToDataExportRequests do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:data_export_requests) do
      add :artifact_metadata, :map
    end
  end
end
