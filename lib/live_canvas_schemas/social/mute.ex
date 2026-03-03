defmodule LCSchemas.Social.Mute do
  use Ecto.Schema

  @type t :: %__MODULE__{
          entropy_id: Ecto.UUID.t() | nil,
          id: integer() | nil,
          inserted_at: DateTime.t() | nil,
          muted: term(),
          muted_id: integer() | nil,
          muter: term(),
          muter_id: integer() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "mutes" do
    field :entropy_id, Ecto.UUID, read_after_writes: true

    belongs_to :muter, LCSchemas.Accounts.User
    belongs_to :muted, LCSchemas.Accounts.User

    timestamps(type: :utc_datetime_usec)
  end
end
