defmodule LCGQL.Content.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Content.Resolver

  enum :post_kind do
    value(:standard)
  end

  enum :post_visibility do
    value(:followers)
    value(:public)
  end

  node object(:post) do
    field :kind, non_null(:post_kind)
    field :body_text, :string
    field :visibility, non_null(:post_visibility)
    field :expires_at, :string
    field :inserted_at, non_null(:string)

    field :author, non_null(:user) do
      resolve(&Resolver.author/3)
    end
  end

  object :content_error do
    field :field, :string
    field :message, non_null(:string)
  end
end
