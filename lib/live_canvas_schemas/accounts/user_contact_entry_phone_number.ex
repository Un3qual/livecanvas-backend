defmodule LCSchemas.Accounts.UserContactEntryPhoneNumber do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{PhoneNumber, UserContactEntry}

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_contact_entry_id: pos_integer() | nil,
          user_contact_entry: UserContactEntry.t() | Ecto.Association.NotLoaded.t(),
          phone_number_id: pos_integer() | nil,
          phone_number: PhoneNumber.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_contact_entry_phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    belongs_to :user_contact_entry, LCSchemas.Accounts.UserContactEntry
    belongs_to :phone_number, LCSchemas.Accounts.PhoneNumber

    timestamps()
  end
end
