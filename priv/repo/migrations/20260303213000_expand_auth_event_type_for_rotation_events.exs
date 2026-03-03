defmodule LiveCanvas.Repo.Migrations.ExpandAuthEventTypeForRotationEvents do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def up do
    execute(
      "ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'refresh_token_rotation_succeeded'"
    )

    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'refresh_token_rotation_failed'")
  end

  def down do
    # PostgreSQL enum values cannot be safely removed in-place.
    :ok
  end
end
