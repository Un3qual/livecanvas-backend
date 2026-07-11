defmodule LC.Infra.Repo.Migrations.PreventSelfBlocks do
  use Ecto.Migration

  def up do
    execute("DELETE FROM blocks WHERE blocker_id = blocked_id")

    create constraint(:blocks, :blocks_distinct_users_check, check: "blocker_id <> blocked_id")
  end

  def down do
    drop constraint(:blocks, :blocks_distinct_users_check)
  end
end
