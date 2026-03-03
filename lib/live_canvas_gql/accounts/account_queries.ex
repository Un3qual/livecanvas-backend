defmodule LCGQL.Accounts.Queries do
  use Absinthe.Schema.Notation

  alias LCGQL.Accounts.Resolver

  object :account_queries do
    field :viewer, :user do
      resolve(&Resolver.viewer/3)
    end
  end
end
