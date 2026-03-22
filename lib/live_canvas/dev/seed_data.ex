defmodule LC.Dev.SeedData do
  @moduledoc """
  Seeds deterministic development accounts with stable credentials.
  """

  alias LC.Accounts
  alias LCSchemas.Accounts.User

  @shared_password "dev-password-123"

  @seed_descriptors [
    %{key: :viewer, email: "dev-viewer@example.com", privacy_mode: :private},
    %{key: :creator, email: "dev-creator@example.com", privacy_mode: :public},
    %{key: :host, email: "dev-host@example.com", privacy_mode: :public}
  ]

  @type account_key :: :viewer | :creator | :host
  @type seeded_user_summary :: %{
          key: account_key(),
          email: String.t(),
          privacy_mode: LCSchemas.Accounts.user_privacy_mode(),
          user_id: pos_integer()
        }
  @type summary :: %{shared_password: String.t(), users: [seeded_user_summary()]}

  @spec seed!() :: summary()
  def seed! do
    users =
      Enum.map(seed_descriptors(), fn descriptor ->
        descriptor
        |> find_or_create_user!()
        |> normalize_password!()
        |> normalize_privacy_mode!(descriptor.privacy_mode)
        |> summarize_user(descriptor)
      end)

    %{shared_password: @shared_password, users: users}
  end

  defp seed_descriptors, do: @seed_descriptors

  defp find_or_create_user!(%{email: email}) do
    case Accounts.get_user_by_email(email) do
      %User{} = user ->
        user

      nil ->
        case Accounts.register_user_with_email(%{email: email}) do
          {:ok, %User{} = user} -> user
          {:error, reason} -> raise "failed to seed development user #{email}: #{inspect(reason)}"
        end
    end
  end

  # Check the stored hash directly so reruns stay idempotent without emitting
  # password-login auth events from the normal sign-in flow.
  defp normalize_password!(%User{} = user) do
    if shared_password?(user) do
      user
    else
      case Accounts.update_user_password(user, %{password: @shared_password}) do
        {:ok, {%User{} = updated_user, _expired_tokens}} ->
          updated_user

        {:error, reason} ->
          raise "failed to set development password for #{user.email}: #{inspect(reason)}"
      end
    end
  end

  defp shared_password?(%User{hashed_password: hashed_password})
       when is_binary(hashed_password) do
    Argon2.verify_pass(@shared_password, hashed_password)
  end

  defp shared_password?(_user), do: false

  defp normalize_privacy_mode!(%User{privacy_mode: privacy_mode} = user, privacy_mode), do: user

  defp normalize_privacy_mode!(%User{} = user, privacy_mode) do
    case Accounts.update_user_privacy_mode(user, privacy_mode) do
      {:ok, %User{} = updated_user} ->
        updated_user

      {:error, reason} ->
        raise "failed to set development privacy mode for #{user.email}: #{inspect(reason)}"
    end
  end

  defp summarize_user(%User{id: user_id, email: email, privacy_mode: privacy_mode}, descriptor) do
    %{
      key: descriptor.key,
      email: email,
      privacy_mode: privacy_mode,
      user_id: user_id
    }
  end
end
