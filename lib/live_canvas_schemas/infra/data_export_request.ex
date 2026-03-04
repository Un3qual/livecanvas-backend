defmodule LCSchemas.Infra.DataExportRequest do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User

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
