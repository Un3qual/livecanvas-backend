defmodule LCSchemas.Infra.AsyncJob do
  use LCSchemas.Schema, :relational

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          kind: String.t() | nil,
          dedupe_key: String.t() | nil,
          status: LCSchemas.Infra.async_job_status() | nil,
          payload: map() | nil,
          attempts: non_neg_integer() | nil,
          max_attempts: pos_integer() | nil,
          scheduled_at: DateTime.t() | nil,
          locked_at: DateTime.t() | nil,
          completed_at: DateTime.t() | nil,
          last_error: String.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "async_jobs" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :kind, :string
    field :dedupe_key, :string

    field :status, Ecto.Enum,
      values: [:pending, :processing, :completed, :failed],
      default: :pending

    field :payload, :map, default: %{}
    field :attempts, :integer, default: 0
    field :max_attempts, :integer, default: 10
    field :scheduled_at, :utc_datetime_usec
    field :locked_at, :utc_datetime_usec
    field :completed_at, :utc_datetime_usec
    field :last_error, :string

    timestamps()
  end
end
