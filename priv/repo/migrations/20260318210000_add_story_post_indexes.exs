defmodule LiveCanvas.Repo.Migrations.AddStoryPostIndexes do
  use Ecto.Migration

  def change do
    create index(:posts, [:kind])
    create index(:posts, [:expires_at])

    # Story feeds filter by kind while ordering newest-first from the shared
    # posts table, so keep a dedicated ordering index for the story slice.
    create index(:posts, [:kind, :inserted_at])
  end
end
