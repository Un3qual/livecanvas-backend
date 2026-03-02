defmodule LiveCanvas.Accounts do
  @moduledoc """
  The Accounts context.
  """

  use Boundary,
    deps: [LiveCanvas.Infra, LiveCanvasSchemas],
    exports: [Tokens]

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [add_error: 3, get_field: 2]

  alias LiveCanvas.Infra.Repo

  alias LiveCanvasSchemas.Accounts.{
    EmailAddress,
    PhoneNumber,
    User,
    UserEmailAddress,
    UserIdentity,
    UserPhoneNumber,
    UserToken
  }

  alias LiveCanvas.Accounts.{Passwords, PhoneNumbers, Scope, Tokens, UserChanges, UserNotifier}

  ## Database getters

  @doc """
  Gets a user by email.
  """
  def get_user_by_email(email) when is_binary(email) do
    email
    |> user_by_email_query()
    |> Repo.one()
  end

  @doc """
  Gets a user by normalized E.164 phone number.
  """
  def get_user_by_phone(phone_number) when is_binary(phone_number) do
    with {:ok, normalized_phone_number} <- PhoneNumbers.normalize(phone_number) do
      normalized_phone_number
      |> user_by_phone_query()
      |> Repo.one()
      |> hydrate_loaded_user()
    else
      _ -> nil
    end
  end

  @doc """
  Gets a user by active external identity.
  """
  def get_user_by_identity(provider, provider_uid)
      when is_atom(provider) and is_binary(provider_uid) do
    provider
    |> user_by_identity_query(provider_uid)
    |> Repo.one()
    |> hydrate_loaded_user()
  end

  @doc """
  Gets a user by email and password.
  """
  def get_user_by_email_and_password(email, password)
      when is_binary(email) and is_binary(password) do
    user = get_user_by_email(email)
    if Passwords.valid_password?(user, password), do: user
  end

  @doc """
  Gets a single user.
  """
  def get_user!(id), do: Repo.get!(User, id) |> put_primary_email()

  ## User registration

  @doc """
  Registers a user.
  """
  def register_user(attrs) do
    register_user_with_email(attrs, [])
  end

  @doc """
  Registers a user and marks the primary email as verified immediately.
  """
  def register_user_with_email(attrs) do
    register_user_with_email(attrs, verified_at: DateTime.utc_now())
  end

  defp register_user_with_email(attrs, attach_opts) do
    changeset = UserChanges.email_changeset(%User{}, attrs)
    email = get_field(changeset, :email)

    Repo.transact(fn ->
      cond do
        not changeset.valid? ->
          {:error, changeset}

        email_taken?(email) ->
          {:error, email_taken_changeset(changeset)}

        true ->
          with {:ok, user} <- Repo.insert(changeset),
               {:ok, _user_email_address} <- attach_email_address(user, email, attach_opts) do
            {:ok, put_primary_email(user)}
          end
      end
    end)
  end

  @doc """
  Returns the registration changeset used by adapter layers.
  """
  def registration_changeset(attrs \\ %{}, opts \\ []) do
    %User{}
    |> UserChanges.email_changeset(attrs, opts)
  end

  ## Settings

  @doc """
  Checks whether the user is in sudo mode.

  The user is in sudo mode when the last authentication was done no further
  than 20 minutes ago. The limit can be given as second argument in minutes.
  """
  def sudo_mode?(user, minutes \\ -20)

  def sudo_mode?(%User{authenticated_at: ts}, minutes) when is_struct(ts, DateTime) do
    DateTime.after?(ts, DateTime.utc_now() |> DateTime.add(minutes, :minute))
  end

  def sudo_mode?(_user, _minutes), do: false

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user email.
  """
  def change_user_email(user, attrs \\ %{}, opts \\ []) do
    UserChanges.email_changeset(user, attrs, opts)
  end

  @doc """
  Updates the user's primary email using the given verification token.
  """
  def update_user_email(user, serialized_value) do
    current_email = current_email_for_user(user.id)

    Repo.transact(fn ->
      with true <- current_email == user.email || {:error, :transaction_aborted},
           {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
           {persisted_user, user_token, persisted_email} <- Repo.one(query),
           true <- persisted_user.id == user.id || {:error, :transaction_aborted},
           true <- persisted_email == current_email || {:error, :transaction_aborted},
           true <-
             Tokens.valid_change_email_token?(user_token, raw_secret) ||
               {:error, :transaction_aborted},
           {:ok, updated_user} <- replace_primary_email(persisted_user, user_token.sent_to),
           {_count, _result} <-
             Repo.delete_all(
               from(token in UserToken,
                 where: token.user_id == ^user.id and token.context == ^:email_verification_token
               )
             ) do
        {:ok, updated_user}
      else
        _ -> {:error, :transaction_aborted}
      end
    end)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user password.
  """
  def change_user_password(user, attrs \\ %{}, opts \\ []) do
    UserChanges.password_changeset(user, attrs, opts)
  end

  @doc """
  Updates the user password.
  """
  def update_user_password(user, attrs) do
    user
    |> UserChanges.password_changeset(attrs)
    |> update_user_and_delete_all_tokens()
  end

  @doc """
  Creates a scope for the given user.
  """
  def scope_for_user(user), do: Scope.for_user(user)

  @doc """
  Returns the empty scope used by adapter layers.
  """
  def empty_scope, do: nil

  @doc """
  Builds an email token payload for the given user.
  """
  def build_user_email_token(user, context), do: Tokens.build_email_token(user, context)

  @doc """
  Persists and returns a token payload for the given user and context.
  """
  def issue_user_token(user, context, attrs \\ []) do
    {serialized_value, user_token} = Tokens.build_token(user, context, attrs)

    case Repo.insert(user_token) do
      {:ok, persisted} -> {:ok, %{token: serialized_value, user_token: persisted}}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Persists and returns an access token payload for the given user.
  """
  def issue_access_token(%User{} = user, attrs \\ []) do
    issue_user_token(user, :access_token, attrs)
  end

  @doc """
  Persists and returns a magic link token payload for the given user.
  """
  def issue_magic_link_token(%User{} = user) do
    issue_user_token(user, :email_magic_link_token, sent_to: user.email)
  end

  @doc """
  Persists and returns an email verification token payload for the given user.
  """
  def issue_email_verification_token(%User{} = user) do
    issue_user_token(user, :email_verification_token, sent_to: user.email)
  end

  @doc false
  def normalize_phone_number(raw_phone_number), do: PhoneNumbers.normalize(raw_phone_number)

  @doc """
  Normalizes and attaches a phone number to the given user.
  """
  def attach_user_phone_number(%User{} = user, raw_phone_number, opts \\ []) do
    with {:ok, normalized_e164} <- normalize_phone_number(raw_phone_number) do
      Repo.transact(fn ->
        Repo.insert(
          %PhoneNumber{normalized_e164: normalized_e164},
          on_conflict: :nothing,
          conflict_target: :normalized_e164
        )

        phone_number = Repo.get_by!(PhoneNumber, normalized_e164: normalized_e164)

        case Repo.insert(
               %UserPhoneNumber{
                 user_id: user.id,
                 phone_number_id: phone_number.id,
                 verified_at: Keyword.get(opts, :verified_at)
               },
               on_conflict: :nothing,
               conflict_target: [:user_id, :phone_number_id]
             ) do
          {:ok, user_phone_number} -> {:ok, Repo.preload(user_phone_number, :phone_number)}
          {:error, changeset} -> {:error, changeset}
        end
      end)
    end
  end

  @doc """
  Normalizes and attaches an email address to the given user.
  """
  def attach_user_email_address(%User{} = user, email, opts \\ []) do
    normalized_email =
      if is_binary(email) do
        String.downcase(email)
      else
        email
      end

    Repo.transact(fn ->
      attach_email_address(user, normalized_email, opts)
    end)
  end

  @doc """
  Registers an external identity for the given user.
  """
  def register_user_identity(%User{} = user, provider, provider_uid, opts \\ [])
      when is_atom(provider) and is_binary(provider_uid) do
    Repo.insert(%UserIdentity{
      user_id: user.id,
      provider: provider,
      provider_uid: provider_uid,
      provider_data: Keyword.get(opts, :provider_data, %{}),
      encrypted_tokens: Keyword.get(opts, :encrypted_tokens),
      last_used_at: Keyword.get(opts, :last_used_at),
      revoked_at: Keyword.get(opts, :revoked_at)
    })
  end

  ## Session

  @doc """
  Generates a session token.
  """
  def generate_user_session_token(user) do
    {serialized_value, user_token} = Tokens.build_session_token(user)
    Repo.insert!(user_token)
    serialized_value
  end

  @doc """
  Gets the user with the given signed token.

  If the token is valid `{user, token_inserted_at}` is returned, otherwise `nil` is returned.
  """
  def get_user_by_session_token(serialized_value) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {user, user_token, current_email} <- Repo.one(query),
         true <- Tokens.valid_session_token?(user_token, raw_secret) do
      user = hydrate_user(user, user_token, current_email)
      {user, user_token.inserted_at}
    else
      _ -> nil
    end
  end

  @doc """
  Gets the user with the given magic link token.
  """
  def get_user_by_magic_link_token(serialized_value) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {user, user_token, current_email} <- Repo.one(query),
         hydrated_user = hydrate_user(user, user_token, current_email),
         true <- Tokens.valid_magic_link_token?(user_token, raw_secret, hydrated_user.email) do
      hydrated_user
    else
      _ -> nil
    end
  end

  @doc """
  Logs the user in by magic link.
  """
  def login_user_by_magic_link(serialized_value) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {user, user_token, current_email} <- Repo.one(query),
         hydrated_user = hydrate_user(user, user_token, current_email),
         true <- Tokens.valid_magic_link_token?(user_token, raw_secret, hydrated_user.email) do
      case hydrated_user do
        %User{confirmed_at: nil, hashed_password: hash} when not is_nil(hash) ->
          raise """
          magic link log in is not allowed for unconfirmed users with a password set!

          This cannot happen with the default implementation, which indicates that you
          might have adapted the code to a different use case. Please make sure to read the
          "Mixing magic link and password registration" section of `mix help phx.gen.auth`.
          """

        %User{confirmed_at: nil} = confirmed_user ->
          confirmed_user
          |> UserChanges.confirm_changeset()
          |> update_user_and_delete_all_tokens()

        confirmed_user ->
          Repo.delete!(user_token)
          {:ok, {confirmed_user, []}}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  @doc ~S"""
  Delivers the update email instructions to the given user.
  """
  def deliver_user_update_email_instructions(%User{} = user, _current_email, update_email_url_fun)
      when is_function(update_email_url_fun, 1) do
    with {:ok, %{token: serialized_value}} <- issue_email_verification_token(user) do
      UserNotifier.deliver_update_email_instructions(
        user,
        update_email_url_fun.(serialized_value)
      )
    end
  end

  @doc """
  Delivers the magic link login instructions to the given user.
  """
  def deliver_login_instructions(%User{} = user, magic_link_url_fun)
      when is_function(magic_link_url_fun, 1) do
    with {:ok, %{token: serialized_value}} <- issue_magic_link_token(user) do
      UserNotifier.deliver_login_instructions(user, magic_link_url_fun.(serialized_value))
    end
  end

  @doc """
  Deletes the signed access token.
  """
  def delete_user_session_token(serialized_value) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {_user, user_token, _current_email} <- Repo.one(query),
         true <- Tokens.valid_session_token?(user_token, raw_secret) do
      Repo.delete!(user_token)
    end

    :ok
  end

  ## Token helper

  defp update_user_and_delete_all_tokens(changeset) do
    Repo.transact(fn ->
      with {:ok, user} <- Repo.update(changeset) do
        tokens_to_expire =
          Repo.all(from(token in UserToken, where: token.user_id == ^user.id))

        Repo.delete_all(
          from(token in UserToken, where: token.id in ^Enum.map(tokens_to_expire, & &1.id))
        )

        {:ok, {put_primary_email(user), tokens_to_expire}}
      end
    end)
  end

  defp attach_email_address(user, email, opts)
  defp attach_email_address(_user, nil, _opts), do: {:error, :missing_email}

  defp attach_email_address(user, email, opts) do
    Repo.insert(
      %EmailAddress{normalized_email: email},
      on_conflict: :nothing,
      conflict_target: :normalized_email
    )

    email_address = Repo.get_by!(EmailAddress, normalized_email: email)

    case Repo.insert(
           %UserEmailAddress{
             user_id: user.id,
             email_address_id: email_address.id,
             verified_at: Keyword.get(opts, :verified_at, user.confirmed_at)
           },
           on_conflict: :nothing,
           conflict_target: [:user_id, :email_address_id]
         ) do
      {:ok, _user_email_address} ->
        user_email_address =
          Repo.get_by!(UserEmailAddress, user_id: user.id, email_address_id: email_address.id)

        {:ok, Repo.preload(user_email_address, :email_address)}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp replace_primary_email(user, email) do
    Repo.delete_all(from(join in UserEmailAddress, where: join.user_id == ^user.id))

    with {:ok, _join} <- attach_email_address(user, email, verified_at: DateTime.utc_now()) do
      {:ok, get_user!(user.id)}
    end
  end

  defp user_by_email_query(email) do
    normalized_email = String.downcase(email)

    from user in User,
      join: user_email_address in assoc(user, :user_email_addresses),
      join: email_address in assoc(user_email_address, :email_address),
      where: email_address.normalized_email == ^normalized_email,
      limit: 1,
      select: %{user | email: email_address.normalized_email}
  end

  defp user_by_phone_query(phone_number) do
    from user in User,
      join: user_phone_number in assoc(user, :user_phone_numbers),
      join: phone_number_row in assoc(user_phone_number, :phone_number),
      where: phone_number_row.normalized_e164 == ^phone_number,
      limit: 1
  end

  defp user_by_identity_query(provider, provider_uid) do
    from user in User,
      join: user_identity in assoc(user, :user_identities),
      where:
        user_identity.provider == ^provider and
          user_identity.provider_uid == ^provider_uid and
          is_nil(user_identity.revoked_at),
      limit: 1
  end

  defp current_email_for_user(user_id) do
    from(email_address in EmailAddress,
      join: user_email_address in UserEmailAddress,
      on: user_email_address.email_address_id == email_address.id,
      where: user_email_address.user_id == ^user_id,
      order_by: [asc: user_email_address.inserted_at],
      limit: 1,
      select: email_address.normalized_email
    )
    |> Repo.one()
  end

  defp put_primary_email(%User{} = user) do
    %{user | email: current_email_for_user(user.id)}
  end

  defp hydrate_loaded_user(%User{} = user), do: put_primary_email(user)
  defp hydrate_loaded_user(nil), do: nil

  defp hydrate_user(user, user_token, current_email) do
    %{
      user
      | authenticated_at: user_token.authenticated_at,
        email: current_email || user_token.sent_to
    }
  end

  defp email_taken?(nil), do: false
  defp email_taken?(email), do: not is_nil(get_user_by_email(email))

  defp email_taken_changeset(changeset),
    do: add_error(changeset, :email, "has already been taken")
end
