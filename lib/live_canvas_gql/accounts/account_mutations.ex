defmodule LiveCanvasGQL.Accounts.Mutations do
  use Absinthe.Schema.Notation

  alias LiveCanvasGQL.Accounts.Resolver

  object :account_mutations do
    field :register_with_email, non_null(:successful_payload) do
      arg(:input, non_null(:register_with_email_input))

      resolve(&Resolver.register_with_email/3)
    end

    field :attach_user_phone_number, non_null(:successful_payload) do
      arg(:input, non_null(:attach_user_phone_number_input))

      resolve(&Resolver.attach_user_phone_number/3)
    end
  end
end
