defmodule LCSchemas.Content.PostReport do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post

  @moduledoc """
  Schema for the `post_reports` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `reason` and `status` are enforced by database check constraints.
  - `(reporter_id, post_id)` is unique.
  - Deleting the reporter or post cascades to reports.
  - Deleting the reviewer nullifies `reviewed_by_id` while preserving the moderation decision history.
  - `(status, inserted_at, id)` supports moderation queue ordering.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          reporter_id: pos_integer() | nil,
          reporter: User.t() | Ecto.Association.NotLoaded.t(),
          reviewed_by_id: pos_integer() | nil,
          reviewed_by: User.t() | Ecto.Association.NotLoaded.t(),
          post_id: pos_integer() | nil,
          post: Post.t() | Ecto.Association.NotLoaded.t(),
          reason: LCSchemas.Content.post_report_reason() | nil,
          details: String.t() | nil,
          status: LCSchemas.Content.post_report_status() | nil,
          decision_note: String.t() | nil,
          reviewed_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "post_reports" do
    field :entropy_id, Ecto.UUID, read_after_writes: true

    field :reason, Ecto.Enum,
      values: [
        :spam,
        :harassment,
        :hate,
        :violence,
        :sexual_content,
        :self_harm,
        :illegal,
        :other
      ]

    field :details, :string
    field :status, Ecto.Enum, values: [:open, :reviewed, :dismissed, :actioned], default: :open
    field :decision_note, :string
    field :reviewed_at, :utc_datetime_usec

    belongs_to :reporter, User
    belongs_to :reviewed_by, User
    belongs_to :post, Post

    timestamps()
  end
end
