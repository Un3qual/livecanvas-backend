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
      end

      resolve(&Resolver.register_with_email/3)
    end

    payload field :attach_user_phone_number do
      input do
        field :phone_number, non_null(:string)
      end

      output do
        field :user, :user
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.attach_user_phone_number/3)
    end

    payload field :upsert_viewer_contact_entry do
      input do
        field :contact_client_id, non_null(:string)
        field :contact_name, :string
        field :birthday, :string
        field :emails, list_of(non_null(:string))
        field :phone_numbers, list_of(non_null(:string))
      end

      output do
        field :contact_match, :contact_match
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.upsert_viewer_contact_entry/3)
    end

    payload field :deliver_viewer_contact_invite do
      input do
        field :recipient, non_null(:string)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.deliver_viewer_contact_invite/3)
    end

    payload field :issue_viewer_auth_tokens do
      input do
        field :device_info, :device_info_input
      end

      output do
        field :access_token, :token
        field :refresh_token, :token
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.issue_viewer_auth_tokens/3)
    end

    payload field :refresh_auth_tokens do
      input do
        field :refresh_token, non_null(:string)
      end

      output do
        field :access_token, :token
        field :refresh_token, :token
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.refresh_auth_tokens/3)
    end

    payload field :revoke_refresh_token do
      input do
        field :refresh_token, non_null(:string)
      end

      output do
        field :revoked, non_null(:boolean)
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.revoke_refresh_token/3)
    end
  end
end
