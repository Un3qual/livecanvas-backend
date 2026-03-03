defmodule LCSchemas.Chat.ChatMessage do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          sender_id: pos_integer() | nil,
          sender: User.t() | Ecto.Association.NotLoaded.t(),
          body: String.t() | nil,
          kind: LCSchemas.Chat.chat_message_kind() | nil,
          metadata: map(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "chat_messages" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :body, :string
    field :kind, Ecto.Enum, values: [:user_message, :system_event], default: :user_message
    field :metadata, :map, default: %{}

    belongs_to :live_session, LiveSession
    belongs_to :sender, User

    timestamps()
  end
end
