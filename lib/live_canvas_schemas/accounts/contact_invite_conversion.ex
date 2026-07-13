defmodule LCSchemas.Accounts.ContactInviteConversion do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

  @moduledoc """
  Schema for the `contact_invite_conversions` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `invite_token_id` is unique so one issued contact invite can produce only one conversion.
  - Both user references use `ON DELETE SET NULL`, preserving one-time consumption after either account is deleted.
  - `invite_secret_hash` is the consumed token's SHA3-256 hash and exists only for authenticated, time-limited idempotent readback; raw token material and recipient email are never stored.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          invite_token_id: Ecto.UUID.t() | nil,
          invite_secret_hash: binary() | nil,
          inviter_id: pos_integer() | nil,
          inviter: User.t() | Ecto.Association.NotLoaded.t(),
          recipient_user_id: pos_integer() | nil,
          recipient_user: User.t() | Ecto.Association.NotLoaded.t(),
          consumed_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "contact_invite_conversions" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :invite_token_id, Ecto.UUID
    field :invite_secret_hash, :binary, redact: true
    field :consumed_at, :utc_datetime_usec

    belongs_to :inviter, User
    belongs_to :recipient_user, User

    timestamps()
  end
end
