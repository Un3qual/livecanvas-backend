defmodule LC.Infra.Repo.Migrations.ExpandAuthEventTypeForProviderUnlinkEvents do
  use Ecto.Migration

  def up do
    execute(
      "ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'provider_identity_unlink_succeeded'"
    )

    execute(
      "ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS 'provider_identity_unlink_failed'"
    )
  end

  def down, do: :ok
end
