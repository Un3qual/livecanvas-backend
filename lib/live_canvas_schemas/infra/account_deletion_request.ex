defmodule LCSchemas.Infra.AccountDeletionRequest do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          status: LCSchemas.Infra.account_deletion_request_status() | nil,
          requested_at: DateTime.t() | nil,
          scheduled_purge_at: DateTime.t() | nil,
          completed_at: DateTime.t() | nil,
          failure_reason: String.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "account_deletion_requests" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :status, LCSchemas.Infra.AccountDeletionRequestStatus, default: :pending
    field :requested_at, :utc_datetime_usec
    field :scheduled_purge_at, :utc_datetime_usec
    field :completed_at, :utc_datetime_usec
    field :failure_reason, :string

    belongs_to :user, User

    timestamps()
  end
end
