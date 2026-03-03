defmodule LCGQL.Accounts.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Accounts.Resolver

  object :account_mutations do
    payload field :register_with_email do
      input do
        field :email, non_null(:string)
      end

      output do
        field :user, :user
        field :errors, non_null(list_of(non_null(:user_error)))
        field :successful, non_null(:boolean)
      end

      resolve(&Resolver.register_with_email/3)
    end

    payload field :attach_user_phone_number do
      input do
        field :user_id, non_null(:id)
        field :phone_number, non_null(:string)
      end

      output do
        field :user, :user
        field :errors, non_null(list_of(non_null(:user_error)))
        field :successful, non_null(:boolean)
      end

      resolve(&Resolver.attach_user_phone_number/3)
    end
  end
end
