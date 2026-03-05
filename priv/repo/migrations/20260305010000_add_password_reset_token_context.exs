defmodule LC.Infra.Repo.Migrations.AddPasswordResetTokenContext do
  use Ecto.Migration

  def up do
    execute("ALTER TYPE user_token_context ADD VALUE IF NOT EXISTS 'password_reset_token'")
  end

  def down do
    # Postgres enum values are additive in place; removing one requires rebuilding the type.
    :ok
  end
end
