defmodule LiveCanvas.Repo.Migrations.DropLegacyChatMessages do
  use Ecto.Migration

  def change do
    drop table(:chat_messages)
  end
end
