defmodule LiveCanvasSchemas.Accounts.UserContactEntryPhoneNumber do
  use Ecto.Schema

  schema "user_contact_entry_phone_numbers" do
    belongs_to :user_contact_entry, LiveCanvasSchemas.Accounts.UserContactEntry
    belongs_to :phone_number, LiveCanvasSchemas.Accounts.PhoneNumber

    timestamps(type: :utc_datetime_usec)
  end
end
