defmodule LiveCanvasSchemas.Accounts.UserPhoneNumber do
  use Ecto.Schema

  schema "user_phone_numbers" do
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User
    belongs_to :phone_number, LiveCanvasSchemas.Accounts.PhoneNumber

    timestamps(type: :utc_datetime_usec)
  end
end
