defmodule LiveCanvasSchemas.Accounts.UserIdentity do
  use LiveCanvasSchemas.Schema, :relational

  schema "user_identities" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :provider, LiveCanvasSchemas.Accounts.UserIdentityProvider
    field :provider_uid, :binary
    field :provider_data, :map, default: %{}
    field :encrypted_tokens, :binary, redact: true
    field :last_used_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User

    timestamps()
  end
end
