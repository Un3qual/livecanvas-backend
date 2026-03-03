defmodule LiveCanvasSchemas.Accounts.UserContactEntryEmailAddress do
  use LiveCanvasSchemas.Schema, :relational

  schema "user_contact_entry_email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    belongs_to :user_contact_entry, LiveCanvasSchemas.Accounts.UserContactEntry
    belongs_to :email_address, LiveCanvasSchemas.Accounts.EmailAddress

    timestamps()
  end
end
