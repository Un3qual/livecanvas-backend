defmodule LiveCanvasSchemas.Accounts.PhoneNumber do
  use LiveCanvasSchemas.Schema, :relational

  schema "phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :normalized_e164, :string

    has_many :user_phone_numbers, LiveCanvasSchemas.Accounts.UserPhoneNumber
    has_many :users, through: [:user_phone_numbers, :user]

    has_many :user_contact_entry_phone_numbers,
             LiveCanvasSchemas.Accounts.UserContactEntryPhoneNumber

    has_many :user_contact_entries,
      through: [:user_contact_entry_phone_numbers, :user_contact_entry]

    timestamps()
  end
end
