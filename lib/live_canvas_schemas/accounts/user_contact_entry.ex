defmodule LCSchemas.Accounts.UserContactEntry do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{
    EmailAddress,
    PhoneNumber,
    User,
    UserContactEntryEmailAddress,
    UserContactEntryPhoneNumber
  }

  @moduledoc """
  Schema for the `user_contact_entries` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(user_id, contact_client_id)` is unique.
  - Deleting the user cascades to their contact entries.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          contact_name: String.t() | nil,
          birthday: Date.t() | nil,
          contact_client_id: binary() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          user_contact_entry_email_addresses:
            Ecto.Association.NotLoaded.t() | [UserContactEntryEmailAddress.t()],
          email_addresses: Ecto.Association.NotLoaded.t() | [EmailAddress.t()],
          user_contact_entry_phone_numbers:
            Ecto.Association.NotLoaded.t() | [UserContactEntryPhoneNumber.t()],
          phone_numbers: Ecto.Association.NotLoaded.t() | [PhoneNumber.t()],
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_contact_entries" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :contact_name, :string
    field :birthday, :date
    field :contact_client_id, :binary

    belongs_to :user, LCSchemas.Accounts.User

    has_many :user_contact_entry_email_addresses,
             LCSchemas.Accounts.UserContactEntryEmailAddress

    has_many :email_addresses, through: [:user_contact_entry_email_addresses, :email_address]

    has_many :user_contact_entry_phone_numbers,
             LCSchemas.Accounts.UserContactEntryPhoneNumber

    has_many :phone_numbers, through: [:user_contact_entry_phone_numbers, :phone_number]

    timestamps()
  end
end
