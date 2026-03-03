defmodule LCGQL.Content.Queries do
  use Absinthe.Schema.Notation

  alias LCGQL.Content.Resolver

  object :content_queries do
    field :post, :post do
      arg(:id, non_null(:id))

      resolve(&Resolver.post/3)
    end
  end
end
