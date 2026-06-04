defmodule LCSchemas.Live.LiveSession do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.MediaAsset
  alias LCSchemas.Live.{LiveMediaSession, LiveParticipant}

  @moduledoc """
  Schema for the `live_sessions` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - Deleting the host user cascades to their live sessions.
  - Deleting a recording media asset nilifies `recording_media_asset_id`.
  - `status` and `recording_media_asset_id` indexes support live/session-history access paths.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          host_id: pos_integer() | nil,
          host: User.t() | Ecto.Association.NotLoaded.t(),
          status: LCSchemas.Live.live_session_status() | nil,
          visibility: LCSchemas.Live.live_session_visibility() | nil,
          started_at: DateTime.t() | nil,
          ended_at: DateTime.t() | nil,
          ended_reason: LCSchemas.Live.live_session_end_reason() | nil,
          recording_media_asset_id: pos_integer() | nil,
          recording_media_asset: MediaAsset.t() | Ecto.Association.NotLoaded.t(),
          live_media_session: LiveMediaSession.t() | Ecto.Association.NotLoaded.t(),
          live_participants: [LiveParticipant.t()] | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_sessions" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :status, Ecto.Enum, values: [:starting, :live, :ended], default: :starting
    field :visibility, Ecto.Enum, values: [:followers, :public], default: :followers
    field :started_at, :utc_datetime_usec
    field :ended_at, :utc_datetime_usec

    field :ended_reason, Ecto.Enum, values: [:host_ended, :moderator_ended, :network_failure]

    belongs_to :host, User
    belongs_to :recording_media_asset, MediaAsset
    has_one :live_media_session, LiveMediaSession
    has_many :live_participants, LiveParticipant

    timestamps()
  end
end
