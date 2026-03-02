defmodule LiveCanvasSchemas.Accounts.UserIdentity do
  use Ecto.Schema

  schema "user_identities" do
    field :provider, LiveCanvasSchemas.Accounts.UserIdentityProvider
    field :provider_uid, :binary
    field :provider_data, :map, default: %{}
    field :encrypted_tokens, :binary, redact: true
    field :last_used_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User

    timestamps(type: :utc_datetime_usec)
  end
end
