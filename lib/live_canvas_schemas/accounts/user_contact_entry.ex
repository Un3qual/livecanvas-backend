defmodule LiveCanvasSchemas.Accounts.UserContactEntry do
  use Ecto.Schema

  schema "user_contact_entries" do
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

    timestamps(type: :utc_datetime_usec)
  end
end
