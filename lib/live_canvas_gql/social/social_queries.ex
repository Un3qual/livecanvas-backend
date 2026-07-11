defmodule LCGQL.Social.Queries do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Social.Resolver

  object :social_queries do
    field :relationship_state, non_null(:relationship_state) do
      arg(:creator_id, non_null(:id))

      resolve(&Resolver.relationship_state/3)
    end

    field :is_muted, non_null(:boolean) do
      arg(:creator_id, non_null(:id))

      resolve(&Resolver.is_muted/3)
    end

    field :is_blocked_by_viewer, non_null(:boolean) do
      arg(:creator_id, non_null(:id))

      resolve(&Resolver.is_blocked_by_viewer/3)
    end

    connection field :viewer_pending_follow_requests,
                 node_type: :follow_request,
                 paginate: :forward do
      resolve(&Resolver.viewer_pending_follow_requests/3)
    end
  end
end
