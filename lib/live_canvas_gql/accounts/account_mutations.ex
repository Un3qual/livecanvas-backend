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

    payload field :request_password_reset do
      input do
        field :email, non_null(:string)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.request_password_reset/3)
    end

    payload field :reset_password do
      input do
        field :token, non_null(:string)
        field :password, non_null(:string)
        field :password_confirmation, non_null(:string)
      end

      output do
        field :reset, non_null(:boolean)
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.reset_password/3)
    end

    payload field :unlink_viewer_identity do
      input do
        field :user_identity_id, non_null(:id)
      end

      output do
        field :user_identity, :user_identity
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.unlink_viewer_identity/3)
    end

    payload field :request_viewer_data_export do
      input do
        field :format, :data_export_request_format
      end

      output do
        field :data_export_request, :data_export_request
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.request_viewer_data_export/3)
    end

    payload field :request_viewer_account_deletion do
      input do
        field :grace_period_seconds, :integer
      end

      output do
        field :account_deletion_request, :account_deletion_request
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.request_viewer_account_deletion/3)
    end

    payload field :cancel_viewer_account_deletion_request do
      input do
        field :account_deletion_request_id, non_null(:id)
      end

      output do
        field :account_deletion_request, :account_deletion_request
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.cancel_viewer_account_deletion_request/3)
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
