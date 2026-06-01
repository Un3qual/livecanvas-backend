defmodule LCSchemas.Chat.LiveSessionModerationAction do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Chat.LiveSessionTimelineEvent
  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `live_session_moderation_actions` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id`, and `:utc_datetime_usec` timestamps.
  - Deleting the live session cascades to moderation actions.
  - Deleting the actor is restricted; deleting a target user or target event nilifies that optional reference.
  - Active actions are indexed by `(live_session_id, target_user_id, action_type)` while `revoked_at` is null.
  - Active `message_removed` actions are unique by `(target_event_id, action_type)`.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          action_type: LCSchemas.Chat.moderation_action_type() | nil,
          actor_user_id: pos_integer() | nil,
          actor: User.t() | Ecto.Association.NotLoaded.t(),
          target_user_id: pos_integer() | nil,
          target_user: User.t() | Ecto.Association.NotLoaded.t() | nil,
          target_event_id: pos_integer() | nil,
          target_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t() | nil,
          reason_code: String.t() | nil,
          internal_note: String.t() | nil,
          expires_at: DateTime.t() | nil,
          revoked_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_session_moderation_actions" do
    field :entropy_id, Ecto.UUID, read_after_writes: true

    field :action_type, Ecto.Enum, values: [:message_removed, :user_muted, :user_banned]

    field :reason_code, :string
    field :internal_note, :string
    field :expires_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :live_session, LiveSession
    belongs_to :actor, User, foreign_key: :actor_user_id
    belongs_to :target_user, User, foreign_key: :target_user_id
    belongs_to :target_event, LiveSessionTimelineEvent

    timestamps()
  end
end
