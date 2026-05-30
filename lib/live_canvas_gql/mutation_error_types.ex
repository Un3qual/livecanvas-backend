defmodule LCGQL.MutationErrorTypes do
  use Absinthe.Schema.Notation

  enum :auth_error_code do
    value(:unauthenticated)
    value(:invalid_input)
    value(:invalid_credentials)
    value(:email_taken)
    value(:token_expired)
    value(:token_revoked)
    value(:unsupported_provider)
    value(:provider_verification_failed)
    value(:passkey_verification_failed)
  end

  object :user_error do
    field :field, :string
    field :message, non_null(:string)
  end

  object :auth_error do
    field :field, :string
    field :code, non_null(:auth_error_code)
    field :message, non_null(:string)
  end
end
