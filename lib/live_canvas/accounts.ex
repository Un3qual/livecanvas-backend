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
    User,
    UserEmailAddress,
    UserToken
  }

  alias LiveCanvas.Accounts.{Passwords, Scope, Tokens, UserChanges, UserNotifier}

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
               {:ok, _user_email_address} <- attach_email_address(user, email) do
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
    {serialized_value, user_token} = Tokens.build_email_token(user, :email_verification_token)

    Repo.insert!(user_token)
    UserNotifier.deliver_update_email_instructions(user, update_email_url_fun.(serialized_value))
  end

  @doc """
  Delivers the magic link login instructions to the given user.
  """
  def deliver_login_instructions(%User{} = user, magic_link_url_fun)
      when is_function(magic_link_url_fun, 1) do
    {serialized_value, user_token} = Tokens.build_email_token(user, :email_magic_link_token)
    Repo.insert!(user_token)
    UserNotifier.deliver_login_instructions(user, magic_link_url_fun.(serialized_value))
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

  defp attach_email_address(user, email, opts \\ [])
  defp attach_email_address(_user, nil, _opts), do: {:error, :missing_email}

  defp attach_email_address(user, email, opts) do
    Repo.insert(
      %EmailAddress{normalized_email: email},
      on_conflict: :nothing,
      conflict_target: :normalized_email
    )

    email_address = Repo.get_by!(EmailAddress, normalized_email: email)

    Repo.insert(
      %UserEmailAddress{
        user_id: user.id,
        email_address_id: email_address.id,
        verified_at: Keyword.get(opts, :verified_at, user.confirmed_at)
      },
      on_conflict: :nothing,
      conflict_target: [:user_id, :email_address_id]
    )
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
