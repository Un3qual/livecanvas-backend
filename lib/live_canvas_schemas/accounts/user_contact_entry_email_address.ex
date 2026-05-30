defmodule LCSchemas.Accounts.UserContactEntryEmailAddress do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{EmailAddress, UserContactEntry}

  @moduledoc """
  Schema for the `user_contact_entry_email_addresses` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(user_contact_entry_id, email_address_id)` is unique.
  - Deleting the contact entry or email address cascades to the join row.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_contact_entry_id: pos_integer() | nil,
          user_contact_entry: UserContactEntry.t() | Ecto.Association.NotLoaded.t(),
          email_address_id: pos_integer() | nil,
          email_address: EmailAddress.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_contact_entry_email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    belongs_to :user_contact_entry, LCSchemas.Accounts.UserContactEntry
    belongs_to :email_address, LCSchemas.Accounts.EmailAddress

    timestamps()
  end
end
