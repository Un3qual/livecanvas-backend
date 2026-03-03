defmodule LCSchemas.Accounts.AuthEvent do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          event_type: LCSchemas.Accounts.auth_event_type() | nil,
          metadata: map(),
          inserted_at: DateTime.t() | nil
        }

  schema "auth_events" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :event_type, LCSchemas.Accounts.AuthEventType
    field :metadata, :map, default: %{}

    belongs_to :user, User

    timestamps(updated_at: false)
  end
end
