defmodule LCSchemas.Chat.LiveSessionTimelineModerationEvent do
  use Ecto.Schema

  alias LCSchemas.Chat.{LiveSessionModerationAction, LiveSessionTimelineEvent}
  alias LCSchemas.Live.LiveSession

  @primary_key false
  @foreign_key_type :id

  @moduledoc """
  Schema for the `live_session_timeline_moderation_events` table.

  Table contract:
  - Moderation-event subtype row keyed by `timeline_event_id`.
  - `live_session_id` is denormalized so the moderation event and durable action are constrained to the same session.
  - Deleting the live session, owning timeline event, or moderation action cascades to this subtype row.
  - `moderation_action_id` is unique so one durable action backs at most one moderation timeline event.
  """

  @type t :: %__MODULE__{
          timeline_event_id: pos_integer() | nil,
          timeline_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t(),
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          moderation_action_id: pos_integer() | nil,
          moderation_action: LiveSessionModerationAction.t() | Ecto.Association.NotLoaded.t()
        }

  schema "live_session_timeline_moderation_events" do
    belongs_to :timeline_event, LiveSessionTimelineEvent, primary_key: true
    belongs_to :live_session, LiveSession
    belongs_to :moderation_action, LiveSessionModerationAction
  end
end
