defmodule LCSchemas.Chat.LiveSessionTimelineChatMessageState do
  use Ecto.Schema

  alias LCSchemas.Chat.LiveSessionTimelineEvent

  @primary_key false
  @foreign_key_type :id

  @moduledoc """
  Schema for the `live_session_timeline_chat_message_states` table.

  Table contract:
  - One mutable chat-message projection row per message event, keyed by `timeline_event_id`.
  - Deleting the source event cascades to the projection row.
  - Deleting the last edit event nilifies `last_edit_event_id`.
  - `last_edit_event_id` is indexed for edit-history lookups, and `edit_count >= 0` is enforced by the database.
  """

  @type t :: %__MODULE__{
          timeline_event_id: pos_integer() | nil,
          timeline_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t(),
          current_body: String.t() | nil,
          edit_count: non_neg_integer(),
          last_edit_event_id: pos_integer() | nil,
          last_edit_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t() | nil,
          last_edited_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_session_timeline_chat_message_states" do
    belongs_to :timeline_event, LiveSessionTimelineEvent, primary_key: true
    field :current_body, :string
    field :edit_count, :integer, default: 0
    belongs_to :last_edit_event, LiveSessionTimelineEvent, foreign_key: :last_edit_event_id
    field :last_edited_at, :utc_datetime_usec
    field :updated_at, :utc_datetime_usec
  end
end
