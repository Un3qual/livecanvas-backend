defmodule LCGQL.Accounts.Queries do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Accounts.Resolver

  object :account_queries do
    field :viewer, :user do
      resolve(&Resolver.viewer/3)
    end

    connection field :viewer_contact_matches, node_type: :contact_match, paginate: :forward do
      resolve(&Resolver.viewer_contact_matches/3)
    end
  end
end
