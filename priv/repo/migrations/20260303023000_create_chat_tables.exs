defmodule LiveCanvas.Repo.Migrations.CreateChatTables do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    create table(:chat_messages) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :sender_id, references(:users, on_delete: :delete_all), null: false
      add :body, :text, null: false
      add :kind, :string, null: false, default: "user_message"
      add :metadata, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create index(:chat_messages, [:live_session_id, :inserted_at, :id])
    create index(:chat_messages, [:sender_id])
    create unique_index(:chat_messages, [:entropy_id])
  end
end
