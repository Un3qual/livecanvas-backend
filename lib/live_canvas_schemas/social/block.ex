defmodule LCSchemas.Social.Block do
  use Ecto.Schema

  @moduledoc """
  Schema for the `blocks` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(blocker_id, blocked_id)` is unique.
  - `blocker_id` and `blocked_id` must identify different users.
  - Deleting either user cascades to the block row.
  - `blocker_id` and `blocked_id` indexes support relationship lookup paths.
  """

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
