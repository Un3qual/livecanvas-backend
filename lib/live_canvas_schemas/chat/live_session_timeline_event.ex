defmodule LCSchemas.Chat.LiveSessionTimelineEvent do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `live_session_timeline_events` table.

  Table contract:
  - Append-only event envelope with bigint `id`, database-generated UUIDv7 `entropy_id`, and `:utc_datetime_usec` timestamps.
  - Deleting the live session cascades to its timeline facts.
  - Deleting an actor nilifies `actor_user_id`; immutable event history must not keep account rows alive.
  - `(live_session_id, occurred_at, id)` supports deterministic timeline keyset ordering.
  - `(target_event_id, live_session_id)` is constrained to target an event in the same live session.
  - `(live_session_id, event_type, idempotency_key)` is unique when `idempotency_key` is present.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          event_type: LCSchemas.Chat.timeline_event_type() | nil,
          actor_user_id: pos_integer() | nil,
          actor: User.t() | Ecto.Association.NotLoaded.t(),
          target_event_id: pos_integer() | nil,
          target_event: t() | Ecto.Association.NotLoaded.t() | nil,
          occurred_at: DateTime.t() | nil,
          idempotency_key: String.t() | nil,
          payload: map(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_session_timeline_events" do
    field :entropy_id, Ecto.UUID, read_after_writes: true

    field :event_type, Ecto.Enum,
      values: [
        :chat_message_sent,
        :chat_message_edited,
        :chat_message_removed,
        :live_session_started,
        :live_session_ended
      ]

    field :occurred_at, :utc_datetime_usec
    field :idempotency_key, :string
    field :payload, :map, default: %{}

    belongs_to :live_session, LiveSession
    belongs_to :actor, User, foreign_key: :actor_user_id
    belongs_to :target_event, __MODULE__, foreign_key: :target_event_id

    timestamps()
  end
end
