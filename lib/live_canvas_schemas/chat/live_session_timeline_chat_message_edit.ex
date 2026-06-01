defmodule LCSchemas.Chat.LiveSessionTimelineChatMessageEdit do
  use Ecto.Schema

  alias LCSchemas.Chat.LiveSessionTimelineEvent

  @primary_key false
  @foreign_key_type :id

  @moduledoc """
  Schema for the `live_session_timeline_chat_message_edits` table.

  Table contract:
  - Immutable edit subtype row keyed by the edit event's `timeline_event_id`.
  - Deleting either the edit event or the target message event cascades to this row.
  - `(target_event_id, timeline_event_id)` supports ordered edit-history lookups.
  - The editor is stored on the edit event envelope as `actor_user_id`.
  """

  @type t :: %__MODULE__{
          timeline_event_id: pos_integer() | nil,
          timeline_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t(),
          target_event_id: pos_integer() | nil,
          target_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t(),
          previous_body: String.t() | nil,
          new_body: String.t() | nil
        }

  schema "live_session_timeline_chat_message_edits" do
    belongs_to :timeline_event, LiveSessionTimelineEvent, primary_key: true
    belongs_to :target_event, LiveSessionTimelineEvent
    field :previous_body, :string
    field :new_body, :string
  end
end
