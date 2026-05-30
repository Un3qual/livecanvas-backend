defmodule LCSchemas.Live.LiveSessionRuntimeOwner do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `live_session_runtime_owners` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `live_session_id` is unique and enforces one runtime owner row per session.
  - Deleting the live session cascades to its runtime owner row.
  - `owner_node` and `lease_expires_at` indexes support ownership claim and expiry paths.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          owner_node: String.t() | nil,
          lease_expires_at: DateTime.t() | nil,
          heartbeat_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_session_runtime_owners" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :owner_node, :string
    field :lease_expires_at, :utc_datetime_usec
    field :heartbeat_at, :utc_datetime_usec

    belongs_to :live_session, LiveSession

    timestamps()
  end
end
