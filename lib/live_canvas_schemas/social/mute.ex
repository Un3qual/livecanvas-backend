defmodule LCSchemas.Social.Mute do
  use Ecto.Schema

  @moduledoc """
  Schema for the `mutes` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(muter_id, muted_id)` is unique.
  - Deleting either user cascades to the mute row.
  - `muter_id` and `muted_id` indexes support relationship lookup paths.
  """

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
