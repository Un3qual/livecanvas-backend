defmodule LCSchemas.Accounts.UserToken do
  use LCSchemas.Schema, :uuid_primary_key

  alias LCSchemas.Accounts.User

  @type t :: %__MODULE__{
          id: Ecto.UUID.t() | nil,
          raw_secret: binary() | nil,
          serialized_value: String.t() | nil,
          secret_hash: binary() | nil,
          context: LCSchemas.Accounts.user_token_context() | nil,
          sent_to: String.t() | nil,
          authenticated_at: DateTime.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil
        }

  schema "users_tokens" do
    field :raw_secret, :binary, virtual: true, redact: true
    # Transport tokens are serialized after insert once Postgres has generated the UUIDv7 id.
    field :serialized_value, :string, virtual: true, redact: true
    field :secret_hash, :binary, redact: true
    field :context, LCSchemas.Accounts.UserTokenContext
    field :sent_to, :string
    field :authenticated_at, :utc_datetime_usec
    belongs_to :user, LCSchemas.Accounts.User

    timestamps(updated_at: false)
  end
end
