defmodule LCSchemas.Accounts.UserIdentity do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

  @moduledoc """
  Schema for the `user_identities` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(provider, provider_uid)` is unique.
  - Deleting the user cascades to their identities.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          provider: LCSchemas.Accounts.user_identity_provider() | nil,
          provider_uid: binary() | nil,
          provider_data: map(),
          encrypted_tokens: binary() | nil,
          last_used_at: DateTime.t() | nil,
          revoked_at: DateTime.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_identities" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :provider, LCSchemas.Accounts.UserIdentityProvider
    field :provider_uid, :binary
    field :provider_data, :map, default: %{}
    field :encrypted_tokens, :binary, redact: true
    field :last_used_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :user, LCSchemas.Accounts.User

    timestamps()
  end
end
