defmodule LiveCanvasGQL.Accounts.Queries do
  use Absinthe.Schema.Notation

  alias LiveCanvasGQL.Accounts.Resolver

  object :account_queries do
    field :viewer, :user do
      arg(:user_id, non_null(:id))

      resolve(&Resolver.viewer/3)
    end

    field :auth_token_valid, non_null(:boolean) do
      arg(:serialized_token, non_null(:string))

      resolve(&Resolver.auth_token_valid/3)
    end
  end
end
