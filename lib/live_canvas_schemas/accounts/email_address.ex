defmodule LCSchemas.Accounts.EmailAddress do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{
    User,
    UserContactEntry,
    UserContactEntryEmailAddress,
    UserEmailAddress
  }

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          normalized_email: String.t() | nil,
          user_email_addresses: Ecto.Association.NotLoaded.t() | [UserEmailAddress.t()],
          users: Ecto.Association.NotLoaded.t() | [User.t()],
          user_contact_entry_email_addresses:
            Ecto.Association.NotLoaded.t() | [UserContactEntryEmailAddress.t()],
          user_contact_entries: Ecto.Association.NotLoaded.t() | [UserContactEntry.t()],
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :normalized_email, :string

    has_many :user_email_addresses, LCSchemas.Accounts.UserEmailAddress
    has_many :users, through: [:user_email_addresses, :user]

    has_many :user_contact_entry_email_addresses,
             LCSchemas.Accounts.UserContactEntryEmailAddress

    has_many :user_contact_entries,
      through: [:user_contact_entry_email_addresses, :user_contact_entry]

    timestamps()
  end
end
