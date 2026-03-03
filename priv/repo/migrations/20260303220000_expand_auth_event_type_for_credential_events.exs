defmodule LiveCanvas.Repo.Migrations.ExpandAuthEventTypeForCredentialEvents do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def up do
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'password_change_succeeded'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'password_change_failed'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'email_change_succeeded'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'email_change_failed'")
  end

  def down do
    # PostgreSQL enum values cannot be safely removed in-place.
    :ok
  end
end
