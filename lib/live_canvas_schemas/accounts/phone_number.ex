defmodule LCSchemas.Accounts.PhoneNumber do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{
    User,
    UserContactEntry,
    UserContactEntryPhoneNumber,
    UserPhoneNumber
  }

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          normalized_e164: String.t() | nil,
          user_phone_numbers: Ecto.Association.NotLoaded.t() | [UserPhoneNumber.t()],
          users: Ecto.Association.NotLoaded.t() | [User.t()],
          user_contact_entry_phone_numbers:
            Ecto.Association.NotLoaded.t() | [UserContactEntryPhoneNumber.t()],
          user_contact_entries: Ecto.Association.NotLoaded.t() | [UserContactEntry.t()],
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :normalized_e164, :string

    has_many :user_phone_numbers, LCSchemas.Accounts.UserPhoneNumber
    has_many :users, through: [:user_phone_numbers, :user]

    has_many :user_contact_entry_phone_numbers,
             LCSchemas.Accounts.UserContactEntryPhoneNumber

    has_many :user_contact_entries,
      through: [:user_contact_entry_phone_numbers, :user_contact_entry]

    timestamps()
  end
end
