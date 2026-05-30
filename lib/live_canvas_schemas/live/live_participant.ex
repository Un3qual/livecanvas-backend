defmodule LCSchemas.Live.LiveParticipant do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `live_participants` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(live_session_id, user_id)` is unique.
  - Deleting the live session or user cascades to participant rows.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          role: LCSchemas.Live.live_participant_role() | nil,
          joined_at: DateTime.t() | nil,
          left_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_participants" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :role, Ecto.Enum, values: [:host, :viewer]
    field :joined_at, :utc_datetime_usec
    field :left_at, :utc_datetime_usec

    belongs_to :live_session, LiveSession
    belongs_to :user, User

    timestamps()
  end
end
