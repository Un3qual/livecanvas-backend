defmodule LiveCanvas.Repo.Migrations.AddChatMessageModerationFields do
  use Ecto.Migration

  def change do
    alter table(:chat_messages) do
      add :status, :string, null: false, default: "active"
      add :moderated_at, :utc_datetime_usec
      add :moderated_by_id, references(:users, on_delete: :nilify_all)
    end

    create index(:chat_messages, [:moderated_by_id])
  end
end
