defmodule LC.Infra.Repo.Migrations.DropLiveSessionRuntimeOwners do
  use Ecto.Migration

  def change do
    drop table(:live_session_runtime_owners)
  end
end
