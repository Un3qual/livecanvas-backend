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

  node object(:user) do
    field :email, :string
    field :inserted_at, non_null(:string)

    connection field :user_identities, node_type: :user_identity, paginate: :forward do
      resolve(&Resolver.user_identities/3)
    end

    connection field :followers, node_type: :user, paginate: :forward do
      resolve(&SocialResolver.followers/3)
    end

    connection field :following, node_type: :user, paginate: :forward do
      resolve(&SocialResolver.following/3)
    end

    field :fresh_access_token, :token
    field :refresh_token, :token
  end

  node object(:user_identity) do
    field :provider, non_null(:string)
    field :oauth_provider, non_null(:oauth_provider)
    field :uid, non_null(:string)
    # field :user, non_null(:user), resolve: dataloader(User)
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

    field :requested_at, non_null(:string) do
      resolve(&Resolver.data_export_requested_at/3)
    end

    field :completed_at, :string do
      resolve(&Resolver.data_export_completed_at/3)
    end

    field :failure_reason, :string
  end

  node object(:account_deletion_request) do
    field :status, non_null(:account_deletion_request_status)

    field :requested_at, non_null(:string) do
      resolve(&Resolver.account_deletion_requested_at/3)
    end

    field :scheduled_purge_at, non_null(:string) do
      resolve(&Resolver.account_deletion_scheduled_purge_at/3)
    end

    field :completed_at, :string do
      resolve(&Resolver.account_deletion_completed_at/3)
    end

    field :failure_reason, :string
  end

  object :token do
    field :serialized_value, non_null(:string)
    field :token_version, non_null(:integer)
    field :expires_at, :string
    field :inserted_at, :string
    field :updated_at, :string
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

  object :user_error do
    field :field, :string
    field :message, non_null(:string)
  end
end
