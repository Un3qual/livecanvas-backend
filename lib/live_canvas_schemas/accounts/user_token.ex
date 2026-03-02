defmodule LiveCanvasSchemas.Accounts.UserToken do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: false}

  schema "users_tokens" do
    field :raw_secret, :binary, virtual: true, redact: true
    field :serialized_value, :string, virtual: true, redact: true
    field :secret_hash, :binary, redact: true
    field :context, LiveCanvasSchemas.Accounts.UserTokenContext
    field :sent_to, :string
    field :authenticated_at, :utc_datetime_usec
    belongs_to :user, LiveCanvasSchemas.Accounts.User

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end
end
