defmodule LCSchemas.Accounts do
  @moduledoc false

  @type user_privacy_mode :: :private | :public

  @type contact_invite_consumption_error :: :invalid_contact_invite

  @type staff_permission :: :post_report_moderation

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
          | :password_reset_token
          | :email_one_time_code_token
          | :contact_invite_token
          | :phone_verification_token
          | :phone_mfa_token
          | :phone_magic_link_token
          | :phone_one_time_code_token
          | :passkey_registration_challenge_token
          | :passkey_authentication_challenge_token
          | :access_token
          | :refresh_token

  @type auth_event_type ::
          :password_login_succeeded
          | :password_login_failed
          | :magic_link_login_succeeded
          | :magic_link_login_failed
          | :refresh_token_revoked
          | :refresh_token_rotation_succeeded
          | :refresh_token_rotation_failed
          | :password_change_succeeded
          | :password_change_failed
          | :email_change_succeeded
          | :email_change_failed
          | :account_recovery_requested
          | :account_recovery_succeeded
          | :account_recovery_failed
          | :provider_identity_unlink_succeeded
          | :provider_identity_unlink_failed
          | :account_deletion_requested
          | :account_deletion_canceled
          | :account_deletion_completed
          | :account_deletion_failed
end
