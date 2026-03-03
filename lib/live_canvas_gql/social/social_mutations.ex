defmodule LCGQL.Social.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Social.Resolver

  object :social_mutations do
    payload field :follow_user do
      input do
        field :follower_id, non_null(:id)
        field :followed_id, non_null(:id)
      end

      output do
        field :follow, :social_follow_payload
        field :errors, non_null(list_of(non_null(:social_error)))
      end

      resolve(&Resolver.follow_user/3)
    end

    payload field :accept_follow_request do
      input do
        field :follower_id, non_null(:id)
        field :followed_id, non_null(:id)
        field :acting_user_id, non_null(:id)
      end

      output do
        field :follow, :social_follow_payload
        field :errors, non_null(list_of(non_null(:social_error)))
      end

      resolve(&Resolver.accept_follow_request/3)
    end

    payload field :block_user do
      input do
        field :blocker_id, non_null(:id)
        field :blocked_id, non_null(:id)
      end

      output do
        field :successful, non_null(:boolean)
        field :errors, non_null(list_of(non_null(:social_error)))
      end

      resolve(&Resolver.block_user/3)
    end
  end
end
