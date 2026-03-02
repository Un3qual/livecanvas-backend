defmodule LiveCanvas.Repo.Migrations.CreateSocialGraphTables do
  use Ecto.Migration

  alias LiveCanvasSchemas.Social.FollowState

  def up do
    FollowState.create_type()

    create table(:follows) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :follower_id, references(:users, on_delete: :delete_all), null: false
      add :followed_id, references(:users, on_delete: :delete_all), null: false
      add :state, :follow_state, null: false
      add :requested_at, :utc_datetime_usec, null: false
      add :accepted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:follows, [:follower_id])
    create index(:follows, [:followed_id])
    create unique_index(:follows, [:entropy_id])
    create unique_index(:follows, [:follower_id, :followed_id])

    create table(:blocks) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :blocker_id, references(:users, on_delete: :delete_all), null: false
      add :blocked_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:blocks, [:blocker_id])
    create index(:blocks, [:blocked_id])
    create unique_index(:blocks, [:entropy_id])
    create unique_index(:blocks, [:blocker_id, :blocked_id])
  end

  def down do
    drop table(:blocks)
    drop table(:follows)

    flush()
    FollowState.drop_type()
  end
end
