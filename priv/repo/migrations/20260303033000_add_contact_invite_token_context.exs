defmodule LiveCanvas.Repo.Migrations.AddContactInviteTokenContext do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def up do
    execute("ALTER TYPE user_token_context ADD VALUE IF NOT EXISTS 'contact_invite_token'")
  end

  def down do
    # Postgres enum values are additive in place; removing one requires rebuilding the type.
    :ok
  end
end
