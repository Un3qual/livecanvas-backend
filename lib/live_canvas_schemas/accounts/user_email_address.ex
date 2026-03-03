defmodule LiveCanvasSchemas.Accounts.UserEmailAddress do
  use LiveCanvasSchemas.Schema, :relational

  schema "user_email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User
    belongs_to :email_address, LiveCanvasSchemas.Accounts.EmailAddress

    timestamps()
  end
end
