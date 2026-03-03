defmodule LCGQL.Accounts.Queries do
  use Absinthe.Schema.Notation

  alias LCGQL.Accounts.Resolver

  object :account_queries do
    field :viewer, :user do
      arg(:user_id, non_null(:id))

      resolve(&Resolver.viewer/3)
    end
  end
end
