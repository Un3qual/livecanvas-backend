defmodule LCSchemas.Social.Block do
  use Ecto.Schema

  @type t :: %__MODULE__{
          blocked: term(),
          blocked_id: integer() | nil,
          blocker: term(),
          blocker_id: integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          id: integer() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "blocks" do
    field :entropy_id, Ecto.UUID, read_after_writes: true

    belongs_to :blocker, LCSchemas.Accounts.User
    belongs_to :blocked, LCSchemas.Accounts.User

    timestamps(type: :utc_datetime_usec)
  end
end
