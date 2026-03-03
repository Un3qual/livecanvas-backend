defmodule LiveCanvasSchemas.Accounts.UserContactEntryPhoneNumber do
  use LiveCanvasSchemas.Schema, :relational

  schema "user_contact_entry_phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    belongs_to :user_contact_entry, LiveCanvasSchemas.Accounts.UserContactEntry
    belongs_to :phone_number, LiveCanvasSchemas.Accounts.PhoneNumber

    timestamps()
  end
end
