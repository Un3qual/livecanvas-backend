defmodule LiveCanvasGQL.Social.Types do
  use Absinthe.Schema.Notation

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

  input_object :follow_user_input do
    field :follower_id, non_null(:id)
    field :followed_id, non_null(:id)
  end

  input_object :accept_follow_request_input do
    field :follower_id, non_null(:id)
    field :followed_id, non_null(:id)
    field :acting_user_id, non_null(:id)
  end

  input_object :block_user_input do
    field :blocker_id, non_null(:id)
    field :blocked_id, non_null(:id)
  end
end
