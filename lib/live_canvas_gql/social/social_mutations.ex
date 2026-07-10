defmodule LCGQL.Social.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Social.Resolver

  object :social_mutations do
    payload field :follow_user do
      input do
        field :followed_id, non_null(:id)
      end

      output do
        field :follow, :social_follow_payload
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.follow_user/3)
    end

    payload field :accept_follow_request do
      input do
        field :follower_id, non_null(:id)
      end

      output do
        field :follow, :social_follow_payload
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.accept_follow_request/3)
    end

    payload field :decline_follow_request do
      input do
        field :follower_id, non_null(:id)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.decline_follow_request/3)
    end

    payload field :block_user do
      input do
        field :blocked_id, non_null(:id)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.block_user/3)
    end

    payload field :unfollow_user do
      input do
        field :followed_id, non_null(:id)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.unfollow_user/3)
    end

    payload field :unblock_user do
      input do
        field :blocked_id, non_null(:id)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.unblock_user/3)
    end

    payload field :mute_user do
      input do
        field :muted_id, non_null(:id)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.mute_user/3)
    end

    payload field :unmute_user do
      input do
        field :muted_id, non_null(:id)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.unmute_user/3)
    end
  end
end
