defmodule LiveCanvasSchemas.Accounts.UserPhoneNumber do
  use LiveCanvasSchemas.Schema, :relational

  schema "user_phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User
    belongs_to :phone_number, LiveCanvasSchemas.Accounts.PhoneNumber

    timestamps()
  end
end
