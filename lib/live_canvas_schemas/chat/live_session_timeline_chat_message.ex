defmodule LCSchemas.Chat.LiveSessionTimelineChatMessage do
  use Ecto.Schema

  alias LCSchemas.Chat.LiveSessionTimelineEvent

  @primary_key false
  @foreign_key_type :id

  @moduledoc """
  Schema for the `live_session_timeline_chat_messages` table.

  Table contract:
  - Immutable chat-message subtype row keyed by `timeline_event_id`.
  - Deleting the owning timeline event cascades to the subtype row.
  - `body_format` is constrained to the supported chat body-format vocabulary.
  - The sender is stored on the event envelope as `actor_user_id`.
  """

  @type t :: %__MODULE__{
          timeline_event_id: pos_integer() | nil,
          timeline_event: LiveSessionTimelineEvent.t() | Ecto.Association.NotLoaded.t(),
          body: String.t() | nil,
          body_format: LCSchemas.Chat.chat_message_body_format() | nil
        }

  schema "live_session_timeline_chat_messages" do
    belongs_to :timeline_event, LiveSessionTimelineEvent, primary_key: true
    field :body, :string
    field :body_format, Ecto.Enum, values: [:plain], default: :plain
  end
end
