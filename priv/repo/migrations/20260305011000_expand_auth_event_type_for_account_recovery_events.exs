defmodule LC.Infra.Repo.Migrations.ExpandAuthEventTypeForAccountRecoveryEvents do
  use Ecto.Migration

  def up do
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_recovery_requested'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_recovery_succeeded'")
    execute("ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'account_recovery_failed'")
  end

  def down, do: :ok
end
