defmodule LiveCanvas.Accounts.Passwords do
  @moduledoc false

  alias LiveCanvasSchemas.Accounts.User

  @doc """
  Verifies the password.
  """
  @spec valid_password?(User.t() | term(), String.t() | term()) :: boolean()
  def valid_password?(%User{hashed_password: hashed_password}, password)
      when is_binary(hashed_password) and byte_size(password) > 0 do
    Argon2.verify_pass(password, hashed_password)
  end

  def valid_password?(_, _) do
    Argon2.no_user_verify()
    false
  end
end
