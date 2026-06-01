defmodule LCSchemas.Chat.LiveSessionTimelineEventState do
  use Ecto.Schema

  alias LCSchemas.Chat.{LiveSessionModerationAction, LiveSessionTimelineEvent}
  alias LCSchemas.Live.LiveSession

  @primary_key false
  @foreign_key_type :id

  @moduledoc """
  Schema for the `live_session_timeline_event_states` table.

  Table contract:
  - One mutable projection row per timeline event, keyed by `timeline_event_id`.
  - Deleting the source event or live session cascades to the projection row.
  - Deleting superseding timeline events or moderation actions nilifies their optional references.
  - The partial `(live_session_id, occurred_at, timeline_event_id)` index covers visible retained-history reads.
  - Database checks enforce the projection-state vocabulary.
  """

  @type t :: %__MODULE__{
          timeline_event_id: pos_integer() | nil,
          timeline_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t(),
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          occurred_at: DateTime.t() | nil,
          projection_state: LCSchemas.Chat.timeline_projection_state() | nil,
          superseded_by_event_id: pos_integer() | nil,
          superseded_by_event:
            LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t() | nil,
          moderation_action_id: pos_integer() | nil,
          moderation_action:
            LiveSessionModerationAction.t() | Ecto.Association.NotLoaded.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_session_timeline_event_states" do
    belongs_to :timeline_event, LiveSessionTimelineEvent, primary_key: true
    belongs_to :live_session, LiveSession
    field :occurred_at, :utc_datetime_usec

    field :projection_state, Ecto.Enum,
      values: [:visible, :hidden, :redacted_placeholder, :internal]

    belongs_to :superseded_by_event, LiveSessionTimelineEvent,
      foreign_key: :superseded_by_event_id

    belongs_to :moderation_action, LiveSessionModerationAction
    field :updated_at, :utc_datetime_usec
  end
end
