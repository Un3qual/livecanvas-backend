defmodule LCGQL.Social.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Social.Resolver

  connection(node_type: :follow_request)

  enum :relationship_state do
    value(:accepted)
    value(:blocked)
    value(:none)
    value(:public)
    value(:requested)
  end

  enum :follow_state do
    value(:requested)
    value(:accepted)
  end

  object :social_follow_payload do
    field :id, non_null(:id)
    field :state, non_null(:follow_state)
  end

  node object(:follow_request) do
    field :state, non_null(:follow_state)

    field :requested_at, non_null(:string)

    field :follower, non_null(:user) do
      resolve(&Resolver.follow_request_follower/3)
    end
  end
end
