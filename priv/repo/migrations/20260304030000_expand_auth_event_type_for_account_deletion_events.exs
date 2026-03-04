defmodule LiveCanvas.Repo.Migrations.ExpandAuthEventTypeForAccountDeletionEvents do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def up do
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_deletion_requested'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_deletion_canceled'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_deletion_completed'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_deletion_failed'")
  end

  def down do
    # PostgreSQL enum values cannot be safely removed in-place.
    :ok
  end
end
