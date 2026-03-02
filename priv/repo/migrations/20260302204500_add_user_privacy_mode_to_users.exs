defmodule LiveCanvas.Repo.Migrations.AddUserPrivacyModeToUsers do
  use Ecto.Migration

  alias LiveCanvasSchemas.Accounts.UserPrivacyMode

  def up do
    UserPrivacyMode.create_type()

    alter table(:users) do
      add :privacy_mode, :user_privacy_mode, null: false, default: "private"
    end
  end

  def down do
    alter table(:users) do
      remove :privacy_mode
    end

    flush()
    UserPrivacyMode.drop_type()
  end
end
