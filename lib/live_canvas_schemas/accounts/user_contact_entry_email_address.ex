defmodule LiveCanvasSchemas.Accounts.UserContactEntryEmailAddress do
  use Ecto.Schema

  schema "user_contact_entry_email_addresses" do
    belongs_to :user_contact_entry, LiveCanvasSchemas.Accounts.UserContactEntry
    belongs_to :email_address, LiveCanvasSchemas.Accounts.EmailAddress

    timestamps(type: :utc_datetime_usec)
  end
end
