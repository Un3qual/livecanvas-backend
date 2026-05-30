defmodule LCSchemas.Content.Post do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.{MediaAsset, PostReport}

  @moduledoc """
  Schema for the `posts` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - Deleting the author cascades to their posts.
  - `kind`, `expires_at`, and `(kind, inserted_at)` indexes support story/feed filtering and ordering.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          author_id: pos_integer() | nil,
          author: User.t() | Ecto.Association.NotLoaded.t(),
          kind: LCSchemas.Content.post_kind() | nil,
          body_text: String.t() | nil,
          visibility: LCSchemas.Content.post_visibility() | nil,
          expires_at: DateTime.t() | nil,
          media_assets: [MediaAsset.t()] | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "posts" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :kind, Ecto.Enum, values: [:standard, :story]
    field :body_text, :string
    field :visibility, Ecto.Enum, values: [:followers, :public], default: :followers
    field :expires_at, :utc_datetime_usec

    belongs_to :author, User
    has_many :media_assets, MediaAsset
    has_many :post_reports, PostReport

    timestamps()
  end
end
