defmodule LC.Accounts.UserChanges do
  import Ecto.Changeset

  alias LCSchemas.Accounts.User

  @type email_attrs :: %{
          optional(:email | String.t()) => String.t()
        }
  @type privacy_attrs :: %{
          optional(:privacy_mode | String.t()) =>
            LCSchemas.Accounts.user_privacy_mode() | String.t()
        }
  @type profile_identity_attrs :: %{
          optional(:display_name | :username | String.t()) => String.t() | nil
        }
  @type suspension_attrs :: %{
          optional(:suspended_at | String.t()) => DateTime.t() | nil
        }
  @type password_attrs :: %{
          optional(:password | :password_confirmation | String.t()) => String.t()
        }

  @doc """
  A user changeset for registering or changing the email.
  """
  @spec email_changeset(User.t(), email_attrs(), keyword()) :: Ecto.Changeset.t()
  def email_changeset(user, attrs, opts \\ []) do
    user
    |> cast(attrs, [:email])
    |> validate_email(opts)
  end

  defp validate_email(changeset, _opts) do
    changeset
    |> validate_required([:email])
    |> update_change(:email, &String.downcase/1)
    |> validate_format(:email, ~r/^[^@,;\s]+@[^@,;\s]+$/,
      message: "must have the @ sign and no spaces"
    )
    |> validate_length(:email, max: 160)
    |> validate_email_changed()
  end

  defp validate_email_changed(changeset) do
    if get_field(changeset, :email) && get_change(changeset, :email) == nil do
      add_error(changeset, :email, "did not change")
    else
      changeset
    end
  end

  @doc """
  A user changeset for updating account-level privacy state.
  """
  @spec privacy_changeset(User.t(), privacy_attrs()) :: Ecto.Changeset.t()
  def privacy_changeset(user, attrs) do
    user
    |> cast(attrs, [:privacy_mode])
    |> validate_required([:privacy_mode])
  end

  @doc """
  A user changeset for canonical public profile identity.
  """
  @spec profile_identity_changeset(User.t(), profile_identity_attrs()) :: Ecto.Changeset.t()
  def profile_identity_changeset(user, attrs) do
    user
    |> cast(attrs, [:display_name, :username])
    |> update_change(:display_name, &normalize_display_name/1)
    |> update_change(:username, &normalize_username/1)
    |> validate_required([:display_name, :username])
    |> validate_length(:display_name, min: 1, max: 50)
    |> validate_format(:display_name, ~r/^[^\x00-\x1F\x7F]+$/u, message: "must be a single line")
    |> validate_length(:username, min: 3, max: 30)
    |> validate_format(:username, ~r/^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/,
      message:
        "must start and end with a letter or number and contain only letters, numbers, or underscores"
    )
    |> unique_constraint(:username)
    |> check_constraint(:username, name: :users_username_format_check)
    |> check_constraint(:display_name, name: :users_display_name_format_check)
  end

  @spec normalize_display_name(String.t() | nil) :: String.t() | nil
  defp normalize_display_name(value) when is_binary(value), do: String.trim(value)
  defp normalize_display_name(nil), do: nil

  @spec normalize_username(String.t() | nil) :: String.t() | nil
  defp normalize_username(value) when is_binary(value),
    do: value |> String.trim() |> String.downcase()

  defp normalize_username(nil), do: nil

  @doc """
  A user changeset for applying a moderation suspension timestamp.
  """
  @spec suspend_changeset(User.t(), DateTime.t()) :: Ecto.Changeset.t()
  def suspend_changeset(user, %DateTime{} = suspended_at) do
    user
    |> cast(%{suspended_at: suspended_at}, [:suspended_at])
    |> validate_required([:suspended_at])
  end

  @doc """
  A user changeset for clearing moderation suspension state.
  """
  @spec unsuspend_changeset(User.t()) :: Ecto.Changeset.t()
  def unsuspend_changeset(user) do
    cast(user, %{suspended_at: nil}, [:suspended_at])
  end

  @doc """
  A user changeset for changing the password.
  """
  @spec password_changeset(User.t(), password_attrs(), keyword()) :: Ecto.Changeset.t()
  def password_changeset(user, attrs, opts \\ []) do
    user
    |> cast(attrs, [:password])
    |> validate_confirmation(:password, message: "does not match password")
    |> validate_password(opts)
  end

  defp validate_password(changeset, opts) do
    changeset
    |> validate_required([:password])
    |> validate_length(:password, min: 12, max: 72)
    |> maybe_hash_password(opts)
  end

  defp maybe_hash_password(changeset, opts) do
    hash_password? = Keyword.get(opts, :hash_password, true)
    password = get_change(changeset, :password)

    if hash_password? && password && changeset.valid? do
      changeset
      |> put_change(:hashed_password, Argon2.hash_pwd_salt(password))
      |> delete_change(:password)
    else
      changeset
    end
  end

  @doc """
  Confirms the account by setting `confirmed_at`.
  """
  @spec confirm_changeset(User.t()) :: Ecto.Changeset.t()
  def confirm_changeset(user) do
    now = DateTime.utc_now()
    change(user, confirmed_at: now)
  end
end
