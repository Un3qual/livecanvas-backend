defmodule LCGQL.Accounts.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Accounts.Resolver
  alias LCGQL.Social.Resolver, as: SocialResolver

  connection(node_type: :user)
  connection(node_type: :user_identity)
  connection(node_type: :contact_match)
  connection(node_type: :data_export_request)
  connection(node_type: :account_deletion_request)

  @desc "Supported auth providers for generic signup, login, and challenge flows."
  enum :auth_provider do
    value(:password)
    value(:magic_link)
    value(:google)
    value(:apple)
    value(:passkey)
  end

  enum :auth_challenge_purpose do
    value(:sign_up)
    value(:log_in)
  end

  @desc "List of supported OAuth providers for logging in."
  enum :oauth_provider do
    value(:apple, description: "Sign in with Apple")
    value(:google, description: "Sign in with Google")
    value(:instagram, description: "Log in with Instagram (not currently supported)")
    value(:facebook, description: "Log in with Facebook (not currently supported)")
    value(:twitter, description: "Log in with Twitter (not currently supported)")
  end

  enum :data_export_request_status do
    value(:pending)
    value(:processing)
    value(:completed)
    value(:failed)
  end

  enum :data_export_request_format do
    value(:json)
  end

  enum :account_deletion_request_status do
    value(:pending)
    value(:scheduled)
    value(:processing)
    value(:completed)
    value(:failed)
    value(:canceled)
  end

  enum :user_privacy_mode do
    value(:private)
    value(:public)
  end

  node object(:user) do
    field :email, :string do
      resolve(&Resolver.user_email/3)
    end

    field :privacy_mode, non_null(:user_privacy_mode)
    field :inserted_at, non_null(:string)

    connection field :posts, node_type: :post, paginate: :forward do
      resolve(&Resolver.user_posts/3)
    end

    connection field :story_feed, node_type: :post, paginate: :forward do
      resolve(&Resolver.user_story_feed/3)
    end

    field :current_live_session, :live_session do
      resolve(&Resolver.user_current_live_session/3)
    end

    connection field :replay_feed, node_type: :live_session, paginate: :forward do
      resolve(&Resolver.user_replay_feed/3)
    end

    connection field :user_identities, node_type: :user_identity, paginate: :forward do
      resolve(&Resolver.user_identities/3)
    end

    connection field :followers, node_type: :user, paginate: :forward do
      resolve(&SocialResolver.followers/3)
    end

    connection field :following, node_type: :user, paginate: :forward do
      resolve(&SocialResolver.following/3)
    end
  end

  node object(:user_identity) do
    field :provider, non_null(:string)

    field :auth_provider, :auth_provider do
      resolve(&Resolver.user_identity_auth_provider/3)
    end

    field :oauth_provider, :oauth_provider, deprecate: "Use authProvider instead." do
      resolve(&Resolver.user_identity_oauth_provider/3)
    end

    field :uid, non_null(:string)

    field :user, non_null(:user) do
      resolve(&Resolver.user_identity_user/3)
    end

    field :inserted_at, non_null(:string)
  end

  node object(:contact_match) do
    field :contact_name, :string do
      resolve(&Resolver.contact_match_name/3)
    end

    field :birthday, :string do
      resolve(&Resolver.contact_match_birthday/3)
    end

    field :matched_users, non_null(list_of(non_null(:user)))
  end

  node object(:data_export_request) do
    field :status, non_null(:data_export_request_status)
    field :format, non_null(:data_export_request_format)

    field :requested_at, non_null(:string)
    field :completed_at, :string

    field :failure_reason, :string
  end

  node object(:account_deletion_request) do
    field :status, non_null(:account_deletion_request_status)

    field :requested_at, non_null(:string)
    field :scheduled_purge_at, non_null(:string)
    field :completed_at, :string

    field :failure_reason, :string
  end

  object :token do
    field :serialized_value, non_null(:string)
    field :token_version, non_null(:integer)
    field :expires_at, :string
    field :inserted_at, :string
    field :updated_at, :string
  end

  object :auth_challenge do
    field :provider, non_null(:auth_provider)
    field :purpose, non_null(:auth_challenge_purpose)
    field :dispatched, non_null(:boolean)
    field :challenge_token, :string
    field :payload_json, :string
  end

  input_object :password_auth_input do
    field :email, :string
    field :password, :string
    field :password_confirmation, :string
  end

  input_object :magic_link_auth_input do
    field :email, :string
    field :token, :string
  end

  input_object :oauth_auth_input do
    field :id_token, :string
  end

  input_object :passkey_auth_input do
    field :email, :string
    field :challenge_token, :string
    field :credential_id, :string
    field :client_data_json, :string
    field :authenticator_data, :string
    field :signature, :string
    field :attestation_object, :string
    field :user_handle, :string
  end

  input_object :auth_input do
    field :provider, non_null(:auth_provider)
    field :password, :password_auth_input
    field :magic_link, :magic_link_auth_input
    field :oauth, :oauth_auth_input
    field :passkey, :passkey_auth_input
  end

  input_object :auth_challenge_input do
    field :provider, non_null(:auth_provider)
    field :purpose, non_null(:auth_challenge_purpose)
    field :magic_link, :magic_link_auth_input
    field :passkey, :passkey_auth_input
  end

  input_object :device_info_input do
    field :device_unique_id, :string
    field :app_version, :string
    field :system_version, :string
    field :carrier, :string
    field :device_mfg, :string
    field :device_model, :string
    field :device_name, :string
    field :system_name, :string
    field :client_launch_count, :integer
  end
end
