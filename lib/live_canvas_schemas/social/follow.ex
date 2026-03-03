defmodule LCSchemas.Social.Follow do
  use Ecto.Schema

  @type t :: %__MODULE__{
          accepted_at: DateTime.t() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          followed: term(),
          followed_id: integer() | nil,
          follower: term(),
          follower_id: integer() | nil,
          id: integer() | nil,
          inserted_at: DateTime.t() | nil,
          requested_at: DateTime.t() | nil,
          state: atom() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "follows" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :state, LCSchemas.Social.FollowState
    field :requested_at, :utc_datetime_usec
    field :accepted_at, :utc_datetime_usec

    belongs_to :follower, LCSchemas.Accounts.User
    belongs_to :followed, LCSchemas.Accounts.User

    timestamps(type: :utc_datetime_usec)
  end
end
