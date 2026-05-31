defmodule LCSchemas.Chat.ChatMessage do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `chat_messages` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - Deleting the live session or sender cascades to messages.
  - Deleting a moderator nilifies `moderated_by_id`.
  - `(live_session_id, inserted_at, id)` supports retained-history pagination order.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          sender_id: pos_integer() | nil,
          sender: User.t() | Ecto.Association.NotLoaded.t(),
          moderated_by_id: pos_integer() | nil,
          moderated_by: User.t() | Ecto.Association.NotLoaded.t(),
          body: String.t() | nil,
          kind: LCSchemas.Chat.chat_message_kind() | nil,
          status: LCSchemas.Chat.chat_message_status() | nil,
          metadata: LCSchemas.Chat.chat_message_metadata(),
          moderated_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "chat_messages" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :body, :string
    field :kind, Ecto.Enum, values: [:user_message, :system_event], default: :user_message
    field :status, Ecto.Enum, values: [:active, :removed], default: :active
    field :metadata, :map, default: %{}
    field :moderated_at, :utc_datetime_usec

    belongs_to :live_session, LiveSession
    belongs_to :sender, User
    belongs_to :moderated_by, User

    timestamps()
  end
end
