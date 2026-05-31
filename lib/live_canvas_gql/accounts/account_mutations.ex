defmodule LCGQL.Accounts.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Accounts.{AuthResolver, ContactResolver, DataGovernanceResolver, UserResolver}

  object :account_mutations do
    payload field :begin_auth_challenge do
      input do
        field :provider, non_null(:auth_provider)
        field :purpose, non_null(:auth_challenge_purpose)
        field :magic_link, :magic_link_auth_input
        field :passkey, :passkey_auth_input
      end

      output do
        field :challenge, :auth_challenge
        field :errors, non_null(list_of(non_null(:auth_error)))
      end

      resolve(&AuthResolver.begin_auth_challenge/3)
    end

    payload field :sign_up do
      input do
        field :provider, non_null(:auth_provider)
        field :password, :password_auth_input
        field :magic_link, :magic_link_auth_input
        field :oauth, :oauth_auth_input
        field :passkey, :passkey_auth_input
      end

      output do
        field :access_token, :token
        field :refresh_token, :token
        field :errors, non_null(list_of(non_null(:auth_error)))
      end

      resolve(&AuthResolver.sign_up/3)
    end

    payload field :log_in do
      input do
        field :provider, non_null(:auth_provider)
        field :password, :password_auth_input
        field :magic_link, :magic_link_auth_input
        field :oauth, :oauth_auth_input
        field :passkey, :passkey_auth_input
      end

      output do
        field :access_token, :token
        field :refresh_token, :token
        field :errors, non_null(list_of(non_null(:auth_error)))
      end

      resolve(&AuthResolver.log_in/3)
    end

    payload field :register_with_email do
      input do
        field :email, non_null(:string)
      end

      output do
        field :user, :user
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&UserResolver.register_with_email/3)
    end

    payload field :attach_user_phone_number do
      input do
        field :phone_number, non_null(:string)
      end

      output do
        field :user, :user
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&UserResolver.attach_user_phone_number/3)
    end

    payload field :update_viewer_privacy_mode do
      input do
        field :privacy_mode, non_null(:user_privacy_mode)
      end

      output do
        field :user, :user
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&UserResolver.update_viewer_privacy_mode/3)
    end

    payload field :request_password_reset do
      input do
        field :email, non_null(:string)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&AuthResolver.request_password_reset/3)
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

      resolve(&AuthResolver.reset_password/3)
    end

    payload field :unlink_viewer_identity do
      input do
        field :user_identity_id, non_null(:id)
      end

      output do
        field :user_identity, :user_identity
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&UserResolver.unlink_viewer_identity/3)
    end

    payload field :request_viewer_data_export do
      input do
        field :format, :data_export_request_format
      end

      output do
        field :data_export_request, :data_export_request
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&DataGovernanceResolver.request_viewer_data_export/3)
    end

    payload field :request_viewer_account_deletion do
      input do
        field :grace_period_seconds, :integer
      end

      output do
        field :account_deletion_request, :account_deletion_request
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&DataGovernanceResolver.request_viewer_account_deletion/3)
    end

    payload field :cancel_viewer_account_deletion_request do
      input do
        field :account_deletion_request_id, non_null(:id)
      end

      output do
        field :account_deletion_request, :account_deletion_request
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&DataGovernanceResolver.cancel_viewer_account_deletion_request/3)
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

      resolve(&ContactResolver.upsert_viewer_contact_entry/3)
    end

    payload field :deliver_viewer_contact_invite do
      input do
        field :recipient, non_null(:string)
      end

      output do
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&ContactResolver.deliver_viewer_contact_invite/3)
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

      resolve(&AuthResolver.issue_viewer_auth_tokens/3)
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

      resolve(&AuthResolver.refresh_auth_tokens/3)
    end

    payload field :revoke_refresh_token do
      input do
        field :refresh_token, non_null(:string)
      end

      output do
        field :revoked, non_null(:boolean)
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&AuthResolver.revoke_refresh_token/3)
    end
  end
end
