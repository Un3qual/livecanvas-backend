defmodule LC.Infra.Repo.Migrations.ExpandUserTokenContextForPasskeyChallenges do
  use Ecto.Migration

  def up do
    execute(
      "ALTER TYPE user_token_context ADD VALUE IF NOT EXISTS 'passkey_registration_challenge_token'"
    )

    execute(
      "ALTER TYPE user_token_context ADD VALUE IF NOT EXISTS 'passkey_authentication_challenge_token'"
    )
  end

  def down do
    # Postgres enum values are additive in place; removing one requires rebuilding the type.
    :ok
  end
end
