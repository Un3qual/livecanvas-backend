defmodule LCGQL.Social.Types do
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

  object :social_error do
    field :field, :string
    field :message, non_null(:string)
  end
end
