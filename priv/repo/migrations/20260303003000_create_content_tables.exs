defmodule LiveCanvas.Repo.Migrations.CreateContentTables do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:posts) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :author_id, references(:users, on_delete: :delete_all), null: false
      add :kind, :string, null: false
      add :body_text, :text
      add :visibility, :string, null: false, default: "followers"
      add :expires_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:posts, [:author_id])
    create index(:posts, [:inserted_at])
    create unique_index(:posts, [:entropy_id])

    create table(:media_assets) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :owner_id, references(:users, on_delete: :delete_all), null: false
      add :post_id, references(:posts, on_delete: :delete_all)
      add :storage_key, :string, null: false
      add :mime_type, :string, null: false
      add :processing_state, :string, null: false, default: "uploaded"
      add :width, :integer
      add :height, :integer
      add :duration_ms, :integer

      timestamps(type: :utc_datetime_usec)
    end

    create index(:media_assets, [:owner_id])
    create index(:media_assets, [:post_id])
    create unique_index(:media_assets, [:entropy_id])
  end
end
