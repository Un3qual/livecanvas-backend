defmodule LiveCanvasGQL.Accounts.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  # import LiveCanvasGQL.Middleware.ErrorPayload.Payload
  # alias LiveCanvasGQL.Accounts.Resolver

  object :account_mutations do
    @desc "Logs in or signs up a user with Apple"
    payload field :apple_authenticate do
      # deprecate "All new GraphQL clients should use the `providerAuthenticate` mutation."

      input do
        field :identity_token, non_null(:string)
        field :authorization_code, non_null(:string)
        field :uid, non_null(:string)
      end

      output do
        field :successful, non_null(:boolean)
        field :result, :integer
      end

      resolve(fn _parent, _args, _res ->
        {:ok, %{successful: true, result: 123}}
      end)

      # resolve &Resolver.apple_authenticate/2
      # middleware &build_payload/2
    end
  end
end
