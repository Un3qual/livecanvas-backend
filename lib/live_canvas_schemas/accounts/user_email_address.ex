defmodule LiveCanvasSchemas.Accounts.UserEmailAddress do
  use Ecto.Schema

  schema "user_email_addresses" do
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User
    belongs_to :email_address, LiveCanvasSchemas.Accounts.EmailAddress

    timestamps(type: :utc_datetime_usec)
  end
end
