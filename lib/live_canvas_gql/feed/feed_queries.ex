defmodule LCGQL.Feed.Queries do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Feed.Resolver

  object :feed_queries do
    connection field :home_feed, node_type: :post, paginate: :forward do
      resolve(&Resolver.home_feed/3)
    end

    connection field :live_now, node_type: :live_session, paginate: :forward do
      resolve(&Resolver.live_now/3)
    end

    connection field :replay_feed, node_type: :live_session, paginate: :forward do
      resolve(&Resolver.replay_feed/3)
    end
  end
end
