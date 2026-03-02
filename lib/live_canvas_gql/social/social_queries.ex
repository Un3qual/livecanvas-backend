defmodule LiveCanvasGQL.Social.Queries do
  use Absinthe.Schema.Notation

  alias LiveCanvasGQL.Social.Resolver

  object :social_queries do
    field :relationship_state, non_null(:relationship_state) do
      arg(:viewer_id, non_null(:id))
      arg(:creator_id, non_null(:id))

      resolve(&Resolver.relationship_state/3)
    end
  end
end
