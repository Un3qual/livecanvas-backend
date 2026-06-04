defmodule LCSchemas.Live.LiveMediaSession do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `live_media_sessions` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(live_session_id)` is unique so each live session has one durable media-readiness row.
  - Deleting the live session cascades to its media-readiness row.
  - `readiness_state` is constrained to `not_ready` or `ready`; `ready_at` is present only when ready.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          readiness_state: LCSchemas.Live.live_media_readiness_state() | nil,
          ready_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_media_sessions" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :readiness_state, Ecto.Enum, values: [:not_ready, :ready], default: :not_ready
    field :ready_at, :utc_datetime_usec

    belongs_to :live_session, LiveSession

    timestamps()
  end
end
