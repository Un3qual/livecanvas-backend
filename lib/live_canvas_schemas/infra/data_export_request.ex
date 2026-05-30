defmodule LCSchemas.Infra.DataExportRequest do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

  @moduledoc """
  Schema for the `data_export_requests` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - Deleting a user nilifies `user_id` to retain governance history.
  - `(user_id, inserted_at)` supports user governance-history lookups.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          status: LCSchemas.Infra.data_export_request_status() | nil,
          format: LCSchemas.Infra.data_export_request_format() | nil,
          requested_at: DateTime.t() | nil,
          completed_at: DateTime.t() | nil,
          artifact_metadata: map() | nil,
          failure_reason: String.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "data_export_requests" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :status, LCSchemas.Infra.DataExportRequestStatus, default: :pending
    field :format, Ecto.Enum, values: [:json], default: :json
    field :requested_at, :utc_datetime_usec
    field :completed_at, :utc_datetime_usec
    field :artifact_metadata, :map
    field :failure_reason, :string

    belongs_to :user, User

    timestamps()
  end
end
