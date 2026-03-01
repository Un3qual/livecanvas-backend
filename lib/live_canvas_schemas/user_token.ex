defmodule LiveCanvasSchemas.UserToken do
  use Ecto.Schema

  schema "users_tokens" do
    field :token, :binary
    field :context, :string
    field :sent_to, :string
    field :authenticated_at, :utc_datetime
    belongs_to :user, LiveCanvasSchemas.User

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
