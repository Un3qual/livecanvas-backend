defmodule LCSchemas.Live.LiveParticipant do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          live_session: LiveSession.t() | Ecto.Association.NotLoaded.t(),
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          role: LCSchemas.Live.live_participant_role() | nil,
          joined_at: DateTime.t() | nil,
          left_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_participants" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :role, Ecto.Enum, values: [:host, :viewer]
    field :joined_at, :utc_datetime_usec
    field :left_at, :utc_datetime_usec

    belongs_to :live_session, LiveSession
    belongs_to :user, User

    timestamps()
  end
end
