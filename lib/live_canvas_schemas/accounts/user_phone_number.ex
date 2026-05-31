defmodule LCSchemas.Accounts.UserPhoneNumber do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{PhoneNumber, User}

  @moduledoc """
  Schema for the `user_phone_numbers` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(user_id, phone_number_id)` is unique.
  - Deleting the user or phone number cascades to the join row.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          verified_at: DateTime.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          phone_number_id: pos_integer() | nil,
          phone_number: PhoneNumber.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LCSchemas.Accounts.User
    belongs_to :phone_number, LCSchemas.Accounts.PhoneNumber

    timestamps()
  end
end
