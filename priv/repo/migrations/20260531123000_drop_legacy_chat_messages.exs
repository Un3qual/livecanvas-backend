defmodule LiveCanvas.Repo.Migrations.DropLegacyChatMessages do
  use Ecto.Migration

  def up do
    drop table(:chat_messages)
  end

  def down do
    create table(:chat_messages) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :sender_id, references(:users, on_delete: :delete_all), null: false
      add :body, :text, null: false
      add :kind, :string, null: false, default: "user_message"
      add :metadata, :map, null: false, default: %{}
      add :status, :string, null: false, default: "active"
      add :moderated_at, :utc_datetime_usec
      add :moderated_by_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create index(:chat_messages, [:live_session_id, :inserted_at, :id])
    create index(:chat_messages, [:sender_id])
    create unique_index(:chat_messages, [:entropy_id])
    create index(:chat_messages, [:moderated_by_id])
  end
end
