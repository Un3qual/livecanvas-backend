defmodule LiveCanvasSchemas.Accounts.UserPhoneNumber do
  use LiveCanvasSchemas.Schema, :relational

  alias LiveCanvasSchemas.Accounts.{PhoneNumber, User}

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          verified_at: DateTime.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          phone_number_id: pos_integer() | nil,
          phone_number: PhoneNumber.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_phone_numbers" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User
    belongs_to :phone_number, LiveCanvasSchemas.Accounts.PhoneNumber

    timestamps()
  end
end
