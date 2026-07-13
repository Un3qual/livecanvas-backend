import EctoEnum

defenum(
  LCSchemas.Accounts.UserTokenContext,
  :user_token_context,
  [
    :email_verification_token,
    :email_mfa_token,
    :email_magic_link_token,
    :password_reset_token,
    :email_one_time_code_token,
    :contact_invite_token,
    :contact_invite_fragment_token,
    :phone_verification_token,
    :phone_mfa_token,
    :phone_magic_link_token,
    :phone_one_time_code_token,
    :passkey_registration_challenge_token,
    :passkey_authentication_challenge_token,
    :access_token,
    :refresh_token
  ]
)
