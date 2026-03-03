import EctoEnum

defenum(
  LCSchemas.Accounts.AuthEventType,
  :auth_event_type,
  [
    :password_login_succeeded,
    :password_login_failed,
    :magic_link_login_succeeded,
    :magic_link_login_failed,
    :refresh_token_revoked,
    :refresh_token_rotation_succeeded,
    :refresh_token_rotation_failed
  ]
)
