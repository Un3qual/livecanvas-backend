defmodule LiveCanvasSchemas.Accounts.PhoneNumber do
  use Ecto.Schema

  schema "phone_numbers" do
    field :normalized_e164, :string

    has_many :user_phone_numbers, LiveCanvasSchemas.Accounts.UserPhoneNumber
    has_many :users, through: [:user_phone_numbers, :user]

    has_many :user_contact_entry_phone_numbers,
             LiveCanvasSchemas.Accounts.UserContactEntryPhoneNumber

    has_many :user_contact_entries,
      through: [:user_contact_entry_phone_numbers, :user_contact_entry]

    timestamps(type: :utc_datetime_usec)
  end
end
