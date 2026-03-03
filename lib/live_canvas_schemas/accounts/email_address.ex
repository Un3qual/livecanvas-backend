defmodule LiveCanvasSchemas.Accounts.EmailAddress do
  use LiveCanvasSchemas.Schema, :relational

  schema "email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :normalized_email, :string

    has_many :user_email_addresses, LiveCanvasSchemas.Accounts.UserEmailAddress
    has_many :users, through: [:user_email_addresses, :user]

    has_many :user_contact_entry_email_addresses,
             LiveCanvasSchemas.Accounts.UserContactEntryEmailAddress

    has_many :user_contact_entries,
      through: [:user_contact_entry_email_addresses, :user_contact_entry]

    timestamps()
  end
end
