defmodule LiveCanvasGQL.Social.Mutations do
  use Absinthe.Schema.Notation

  alias LiveCanvasGQL.Social.Resolver

  object :social_mutations do
    field :follow_user, non_null(:social_follow_payload) do
      arg(:input, non_null(:follow_user_input))

      resolve(&Resolver.follow_user/3)
    end

    field :accept_follow_request, non_null(:social_follow_payload) do
      arg(:input, non_null(:accept_follow_request_input))

      resolve(&Resolver.accept_follow_request/3)
    end

    field :block_user, non_null(:successful_payload) do
      arg(:input, non_null(:block_user_input))

      resolve(&Resolver.block_user/3)
    end
  end
end
