defmodule LiveCanvasSchemas.Accounts.UserEmailAddress do
  use LiveCanvasSchemas.Schema, :relational

  alias LiveCanvasSchemas.Accounts.{EmailAddress, User}

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          verified_at: DateTime.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          email_address_id: pos_integer() | nil,
          email_address: EmailAddress.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "user_email_addresses" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :verified_at, :utc_datetime_usec

    belongs_to :user, LiveCanvasSchemas.Accounts.User
    belongs_to :email_address, LiveCanvasSchemas.Accounts.EmailAddress

    timestamps()
  end
end
