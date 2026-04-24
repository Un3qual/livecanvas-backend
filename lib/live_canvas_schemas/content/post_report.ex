defmodule LCSchemas.Content.PostReport do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          reporter_id: pos_integer() | nil,
          reporter: User.t() | Ecto.Association.NotLoaded.t(),
          post_id: pos_integer() | nil,
          post: Post.t() | Ecto.Association.NotLoaded.t(),
          reason: LCSchemas.Content.post_report_reason() | nil,
          details: String.t() | nil,
          status: LCSchemas.Content.post_report_status() | nil,
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

    belongs_to :reporter, User
    belongs_to :post, Post

    timestamps()
  end
end
