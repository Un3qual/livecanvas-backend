defmodule LCSchemas.Accounts.UserEmailAddress do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{EmailAddress, User}

  @moduledoc """
  Schema for the `user_email_addresses` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(user_id, email_address_id)` is unique.
  - Deleting the user or email address cascades to the join row.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          verified_at: DateTime.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          email_address_id: pos_integer() | nil,
          email_address: EmailAddress.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LCSchemas.Accounts.User
    belongs_to :email_address, LCSchemas.Accounts.EmailAddress

    timestamps()
  end
end
