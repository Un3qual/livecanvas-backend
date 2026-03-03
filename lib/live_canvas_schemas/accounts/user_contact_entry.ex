defmodule LiveCanvasSchemas.Accounts.UserContactEntry do
  use LiveCanvasSchemas.Schema, :relational

  schema "user_contact_entries" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :contact_name, :string
    field :birthday, :date
    field :contact_client_id, :binary

    belongs_to :user, LiveCanvasSchemas.Accounts.User

    has_many :user_contact_entry_email_addresses,
             LiveCanvasSchemas.Accounts.UserContactEntryEmailAddress

    has_many :email_addresses, through: [:user_contact_entry_email_addresses, :email_address]

    has_many :user_contact_entry_phone_numbers,
             LiveCanvasSchemas.Accounts.UserContactEntryPhoneNumber

    has_many :phone_numbers, through: [:user_contact_entry_phone_numbers, :phone_number]

    timestamps()
  end
end
