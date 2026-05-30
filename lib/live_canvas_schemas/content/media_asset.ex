defmodule LCSchemas.Content.MediaAsset do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post

  @moduledoc """
  Schema for the `media_assets` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - Deleting the owner cascades to their media assets.
  - Deleting the optional post cascades to attached media assets.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          owner_id: pos_integer() | nil,
          owner: User.t() | Ecto.Association.NotLoaded.t(),
          post_id: pos_integer() | nil,
          post: Post.t() | Ecto.Association.NotLoaded.t(),
          storage_key: String.t() | nil,
          mime_type: String.t() | nil,
          processing_state: LCSchemas.Content.media_processing_state() | nil,
          width: integer() | nil,
          height: integer() | nil,
          duration_ms: integer() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "media_assets" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :storage_key, :string
    field :mime_type, :string

    field :processing_state, Ecto.Enum,
      values: [:pending_upload, :uploaded, :processed, :failed],
      default: :uploaded

    field :width, :integer
    field :height, :integer
    field :duration_ms, :integer

    belongs_to :owner, User
    belongs_to :post, Post

    timestamps()
  end
end
