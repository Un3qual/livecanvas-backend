import EctoEnum

defenum(
  LiveCanvasSchemas.Accounts.UserTokenContext,
  :user_token_context,
  [
    :email_verification_token,
    :email_mfa_token,
    :email_magic_link_token,
    :email_one_time_code_token,
    :phone_verification_token,
    :phone_mfa_token,
    :phone_magic_link_token,
    :phone_one_time_code_token,
    :access_token,
    :refresh_token
  ]
)
