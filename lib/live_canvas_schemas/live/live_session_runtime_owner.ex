defmodule LCSchemas.Live.LiveSessionRuntimeOwner do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Live.LiveSession

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
