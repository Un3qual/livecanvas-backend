defmodule LCSchemas.Infra.WebhookEvent do
  use LCSchemas.Schema, :relational

  @moduledoc """
  Schema for the `webhook_events` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `(provider, external_event_id)` is unique for webhook idempotency.
  - `(status, received_at)` supports processing scans.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          provider: String.t() | nil,
          external_event_id: String.t() | nil,
          event_type: String.t() | nil,
          status: LCSchemas.Infra.webhook_event_status() | nil,
          payload: map() | nil,
          received_at: DateTime.t() | nil,
          processed_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "webhook_events" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :provider, :string
    field :external_event_id, :string
    field :event_type, :string
    field :status, Ecto.Enum, values: [:received, :processed, :failed], default: :received
    field :payload, :map, default: %{}
    field :received_at, :utc_datetime_usec
    field :processed_at, :utc_datetime_usec

    timestamps()
  end
end
