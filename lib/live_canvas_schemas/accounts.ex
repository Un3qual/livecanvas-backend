defmodule LCSchemas.Accounts do
  @moduledoc false

  @type user_privacy_mode :: :private | :public

  @type user_identity_provider ::
          :apple_provider
          | :google_provider
          | :passkey_provider
          | :snap_provider
          | :instagram_provider

  @type user_token_context ::
          :email_verification_token
          | :email_mfa_token
          | :email_magic_link_token
          | :email_one_time_code_token
          | :phone_verification_token
          | :phone_mfa_token
          | :phone_magic_link_token
          | :phone_one_time_code_token
          | :access_token
          | :refresh_token
end
