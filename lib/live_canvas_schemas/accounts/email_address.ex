defmodule LiveCanvasSchemas.Accounts.EmailAddress do
  use Ecto.Schema

  schema "email_addresses" do
    field :normalized_email, :string

    has_many :user_email_addresses, LiveCanvasSchemas.Accounts.UserEmailAddress
    has_many :users, through: [:user_email_addresses, :user]

    has_many :user_contact_entry_email_addresses,
             LiveCanvasSchemas.Accounts.UserContactEntryEmailAddress

    has_many :user_contact_entries,
      through: [:user_contact_entry_email_addresses, :user_contact_entry]

    timestamps(type: :utc_datetime_usec)
  end
end
