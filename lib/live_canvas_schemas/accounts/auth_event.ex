defmodule LCSchemas.Accounts.AuthEvent do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

  @moduledoc """
  Schema for the `auth_events` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and insert-only `:utc_datetime_usec` timestamps.
  - Deleting a user nilifies `user_id` to retain audit history.
  - `user_id`, `event_type`, and `inserted_at` indexes support audit lookup paths.
  """

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
