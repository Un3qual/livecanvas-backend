defmodule LCSchemas.Accounts.UserPasskey do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{User, UserIdentity}

  @moduledoc """
  Schema for the `user_passkeys` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `credential_id` is unique, and `user_identity_id` is unique.
  - Deleting the user or identity cascades to their passkeys.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          user_identity_id: pos_integer() | nil,
          user_identity: UserIdentity.t() | Ecto.Association.NotLoaded.t(),
          credential_id: String.t() | nil,
          public_key: binary() | nil,
          sign_count: non_neg_integer(),
          transports: [String.t()],
          last_used_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_passkeys" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :credential_id, :string
    field :public_key, :binary, redact: true
    field :sign_count, :integer, default: 0
    field :transports, {:array, :string}, default: []
    field :last_used_at, :utc_datetime_usec

    belongs_to :user, LCSchemas.Accounts.User
    belongs_to :user_identity, LCSchemas.Accounts.UserIdentity

    timestamps()
  end
end
