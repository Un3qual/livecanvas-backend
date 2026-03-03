defmodule LC.Accounts do
  @moduledoc """
  The Accounts context.
  """

  use Boundary,
    deps: [LC.Infra, LCSchemas],
    exports: [Tokens]

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [add_error: 3, get_field: 2]

  alias LC.Infra.Repo

  alias LCSchemas.Accounts.{
    EmailAddress,
    PhoneNumber,
    User,
    UserContactEntry,
    UserContactEntryEmailAddress,
    UserContactEntryPhoneNumber,
    UserEmailAddress,
    UserIdentity,
    UserPhoneNumber,
    UserToken
  }

  alias LC.Accounts.{
    Passwords,
    PhoneNotifier,
    PhoneNumbers,
    Scope,
    Tokens,
    UserChanges,
    UserNotifier
  }

  @type changeset :: Ecto.Changeset.t()
  @type user_result :: {:ok, User.t()} | {:error, changeset()}
  @type user_with_tokens_result :: {:ok, {User.t(), [UserToken.t()]}} | {:error, changeset()}
  @type token_context :: LCSchemas.Accounts.user_token_context()

  @type email_token_context ::
          :email_verification_token
          | :email_mfa_token
          | :email_magic_link_token
          | :email_one_time_code_token

  @type token_payload :: %{token: String.t(), user_token: UserToken.t()}
  @type token_result :: {:ok, token_payload()} | {:error, changeset()}
  @type phone_token_payload :: %{
          token: String.t(),
          user_token: UserToken.t(),
          phone_number: String.t()
        }
  @type phone_token_result ::
          {:ok, phone_token_payload()}
          | {:error, :invalid_phone_number | :phone_number_not_found | changeset()}
  @type contact_entry_attrs :: %{
          optional(:contact_client_id | :contact_name | :birthday | :emails | :phone_numbers) =>
            term(),
          optional(String.t()) => term()
        }
  @type upsert_contact_entry_result ::
          {:ok, UserContactEntry.t()}
          | {:error,
             :invalid_contact_client_id
             | :invalid_birthday
             | :invalid_phone_number
             | :invalid_email_list}
  @type contact_match :: %{
          required(:id) => pos_integer(),
          required(:contact_entry) => UserContactEntry.t(),
          required(:matched_users) => [User.t()]
        }
  @type user_session_result :: {User.t(), DateTime.t()} | nil
  @type registration_attrs :: %{
          optional(:email | :password | String.t()) => String.t()
        }
  @type email_change_attrs :: %{
          optional(:email | String.t()) => String.t()
        }
  @type password_change_attrs :: %{
          optional(:password | :password_confirmation | String.t()) => String.t()
        }

  ## Database getters

  @doc """
  Gets a user by email.
  """
  @spec get_user_by_email(String.t()) :: User.t() | nil
  def get_user_by_email(email) when is_binary(email) do
    email
    |> user_by_email_query()
    |> Repo.one()
  end

  @doc """
  Gets a user by normalized E.164 phone number.
  """
  @spec get_user_by_phone(String.t()) :: User.t() | nil
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
  @spec get_user_by_identity(atom(), String.t()) :: User.t() | nil
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
  @spec get_user_by_email_and_password(String.t(), String.t()) :: User.t() | nil
  def get_user_by_email_and_password(email, password)
      when is_binary(email) and is_binary(password) do
    user = get_user_by_email(email)
    if Passwords.valid_password?(user, password), do: user
  end

  @doc """
  Gets a single user.
  """
  @spec get_user!(pos_integer()) :: User.t()
  def get_user!(id), do: Repo.get!(User, id) |> put_primary_email()

  @doc """
  Gets a single user identity.
  """
  @spec get_user_identity!(pos_integer()) :: UserIdentity.t()
  def get_user_identity!(id), do: Repo.get!(UserIdentity, id)

  @doc """
  Returns a deterministic query for a user's linked identities.
  """
  @spec user_identities_query(User.t()) :: Ecto.Query.t()
  def user_identities_query(%User{id: user_id}) do
    from(user_identity in UserIdentity,
      where: user_identity.user_id == ^user_id,
      order_by: [asc: user_identity.inserted_at, asc: user_identity.id]
    )
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  ## User registration

  @doc """
  Registers a user.
  """
  @spec register_user(registration_attrs()) :: user_result()
  def register_user(attrs) do
    register_user_with_email(attrs, [])
  end

  @doc """
  Registers a user and marks the primary email as verified immediately.
  """
  @spec register_user_with_email(registration_attrs()) :: user_result()
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
  @spec registration_changeset(registration_attrs(), keyword()) :: changeset()
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
  @spec sudo_mode?(User.t() | term(), integer()) :: boolean()
  def sudo_mode?(user, minutes \\ -20)

  def sudo_mode?(%User{authenticated_at: ts}, minutes) when is_struct(ts, DateTime) do
    DateTime.after?(ts, DateTime.utc_now() |> DateTime.add(minutes, :minute))
  end

  def sudo_mode?(_user, _minutes), do: false

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user email.
  """
  @spec change_user_email(User.t(), email_change_attrs(), keyword()) :: changeset()
  def change_user_email(user, attrs \\ %{}, opts \\ []) do
    UserChanges.email_changeset(user, attrs, opts)
  end

  @doc """
  Updates the user's account-level privacy mode.
  """
  @spec update_user_privacy_mode(User.t(), LCSchemas.Accounts.user_privacy_mode()) ::
          user_result()
  def update_user_privacy_mode(%User{} = user, privacy_mode) do
    case user
         |> UserChanges.privacy_changeset(%{privacy_mode: privacy_mode})
         |> Repo.update() do
      {:ok, updated_user} -> {:ok, hydrate_loaded_user(updated_user)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Updates the user's primary email using the given verification token.
  """
  @spec update_user_email(User.t(), String.t()) ::
          {:ok, User.t()} | {:error, :transaction_aborted}
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
  @spec change_user_password(User.t(), password_change_attrs(), keyword()) :: changeset()
  def change_user_password(user, attrs \\ %{}, opts \\ []) do
    UserChanges.password_changeset(user, attrs, opts)
  end

  @doc """
  Updates the user password.
  """
  @spec update_user_password(User.t(), password_change_attrs()) :: user_with_tokens_result()
  def update_user_password(user, attrs) do
    user
    |> UserChanges.password_changeset(attrs)
    |> update_user_and_delete_all_tokens()
  end

  @doc """
  Creates a scope for the given user.
  """
  @spec scope_for_user(User.t() | nil) :: Scope.t() | nil
  def scope_for_user(user), do: Scope.for_user(user)

  @doc """
  Returns the empty scope used by adapter layers.
  """
  @spec empty_scope() :: nil
  def empty_scope, do: nil

  @doc """
  Builds an email token payload for the given user.
  """
  @spec build_user_email_token(User.t(), email_token_context()) :: {binary(), UserToken.t()}
  def build_user_email_token(user, context), do: Tokens.build_email_token(user, context)

  @doc """
  Persists and returns a token payload for the given user and context.
  """
  @spec issue_user_token(User.t(), token_context(), keyword()) :: token_result()
  def issue_user_token(user, context, attrs \\ []) do
    {raw_secret, user_token} = Tokens.build_token(user, context, attrs)

    case Repo.insert(user_token) do
      {:ok, persisted} ->
        # The token transport value must embed the persisted UUID, so encode only after insert.
        serialized_value = Tokens.encode_serialized_value(persisted.id, raw_secret)
        {:ok, %{token: serialized_value, user_token: persisted}}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  @doc """
  Persists and returns an access token payload for the given user.
  """
  @spec issue_access_token(User.t(), keyword()) :: token_result()
  def issue_access_token(%User{} = user, attrs \\ []) do
    issue_user_token(user, :access_token, attrs)
  end

  @doc """
  Persists and returns a magic link token payload for the given user.
  """
  @spec issue_magic_link_token(User.t()) :: token_result()
  def issue_magic_link_token(%User{} = user) do
    issue_user_token(user, :email_magic_link_token, sent_to: user.email)
  end

  @doc """
  Persists and returns an email verification token payload for the given user.
  """
  @spec issue_email_verification_token(User.t()) :: token_result()
  def issue_email_verification_token(%User{} = user) do
    issue_user_token(user, :email_verification_token, sent_to: user.email)
  end

  @doc """
  Persists and returns a contact invite token payload for the given recipient.
  """
  @spec issue_contact_invite_token(User.t(), String.t()) :: token_result()
  def issue_contact_invite_token(%User{} = user, recipient) when is_binary(recipient) do
    # Invite recipients are persisted in normalized form so token lookups stay deterministic.
    issue_user_token(
      user,
      :contact_invite_token,
      sent_to: normalize_invite_recipient(recipient)
    )
  end

  @doc """
  Persists and returns a phone verification token payload for the given user.
  """
  @spec issue_phone_verification_token(User.t(), term()) :: phone_token_result()
  def issue_phone_verification_token(%User{} = user, raw_phone_number) do
    with {:ok, normalized_phone_number} <- normalize_phone_number(raw_phone_number),
         true <-
           user_has_phone_number?(user.id, normalized_phone_number) ||
             {:error, :phone_number_not_found},
         {:ok, %{token: token, user_token: persisted}} <-
           issue_user_token(user, :phone_verification_token, sent_to: normalized_phone_number) do
      {:ok, %{token: token, user_token: persisted, phone_number: normalized_phone_number}}
    end
  end

  @doc false
  @spec normalize_phone_number(term()) :: {:ok, String.t()} | {:error, :invalid_phone_number}
  def normalize_phone_number(raw_phone_number), do: PhoneNumbers.normalize(raw_phone_number)

  @doc """
  Normalizes and attaches a phone number to the given user.
  """
  @spec attach_user_phone_number(User.t(), term(), keyword()) ::
          {:ok, UserPhoneNumber.t()} | {:error, :invalid_phone_number | changeset()}
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
  @spec attach_user_email_address(User.t(), term(), keyword()) ::
          {:ok, UserEmailAddress.t()} | {:error, :missing_email | changeset()}
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
  @spec register_user_identity(User.t(), atom(), String.t(), keyword()) ::
          {:ok, UserIdentity.t()} | {:error, changeset()}
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

  @doc """
  Upserts a contact entry for a user and syncs its normalized identifier joins.
  """
  @spec upsert_user_contact_entry(User.t(), contact_entry_attrs()) ::
          upsert_contact_entry_result()
  def upsert_user_contact_entry(%User{} = user, attrs) when is_map(attrs) do
    with {:ok, contact_client_id} <-
           normalize_contact_client_id(fetch_attr(attrs, :contact_client_id)),
         {:ok, contact_name} <- normalize_contact_name(fetch_attr(attrs, :contact_name)),
         {:ok, birthday} <- normalize_contact_birthday(fetch_attr(attrs, :birthday)),
         {:ok, emails} <- normalize_contact_emails(fetch_attr(attrs, :emails, [])),
         {:ok, phone_numbers} <-
           normalize_contact_phone_numbers(fetch_attr(attrs, :phone_numbers, [])) do
      Repo.transact(fn ->
        with {:ok, contact_entry} <-
               upsert_contact_entry_row(user, contact_client_id, contact_name, birthday),
             :ok <- sync_contact_entry_emails(contact_entry.id, emails),
             :ok <- sync_contact_entry_phone_numbers(contact_entry.id, phone_numbers) do
          {:ok, preload_contact_entry(contact_entry)}
        end
      end)
    end
  end

  @doc """
  Lists imported contact entries with the matched users for each entry.
  """
  @spec list_user_contact_matches(User.t()) :: [contact_match()]
  def list_user_contact_matches(%User{} = user) do
    user.id
    |> user_contact_entries_query()
    |> Repo.all()
    |> Repo.preload([:email_addresses, :phone_numbers])
    |> Enum.map(&build_contact_match(user.id, &1))
  end

  @doc """
  Returns one viewer-owned contact match by contact entry id.
  """
  @spec get_user_contact_match(User.t(), pos_integer()) :: contact_match() | nil
  def get_user_contact_match(%User{} = user, contact_entry_id)
      when is_integer(contact_entry_id) and contact_entry_id > 0 do
    user.id
    |> user_contact_entry_by_id_query(contact_entry_id)
    |> Repo.one()
    |> case do
      nil ->
        nil

      contact_entry ->
        build_contact_match(user.id, preload_contact_entry(contact_entry))
    end
  end

  def get_user_contact_match(%User{}, _contact_entry_id), do: nil

  ## Session

  @doc """
  Generates a session token.
  """
  @spec generate_user_session_token(User.t()) :: String.t()
  def generate_user_session_token(user) do
    {raw_secret, user_token} = Tokens.build_session_token(user)
    persisted = Repo.insert!(user_token)
    Tokens.encode_serialized_value(persisted.id, raw_secret)
  end

  @doc """
  Gets the user with the given signed token.

  If the token is valid `{user, token_inserted_at}` is returned, otherwise `nil` is returned.
  """
  @spec get_user_by_session_token(String.t()) :: user_session_result()
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
  @spec get_user_by_magic_link_token(String.t()) :: User.t() | nil
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
  @spec login_user_by_magic_link(String.t()) ::
          {:ok, {User.t(), [UserToken.t()]}} | {:error, :not_found | changeset()}
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
  @spec deliver_user_update_email_instructions(User.t(), String.t(), (String.t() -> String.t())) ::
          {:ok, Swoosh.Email.t()} | {:error, changeset()}
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
  @spec deliver_login_instructions(User.t(), (String.t() -> String.t())) ::
          {:ok, Swoosh.Email.t()} | {:error, changeset()}
  def deliver_login_instructions(%User{} = user, magic_link_url_fun)
      when is_function(magic_link_url_fun, 1) do
    with {:ok, %{token: serialized_value}} <- issue_magic_link_token(user) do
      UserNotifier.deliver_login_instructions(user, magic_link_url_fun.(serialized_value))
    end
  end

  @doc """
  Delivers contact invite instructions to the provided recipient.
  """
  @spec deliver_contact_invite_instructions(User.t(), String.t(), (String.t() -> String.t())) ::
          {:ok, Swoosh.Email.t()} | {:error, changeset() | term()}
  def deliver_contact_invite_instructions(%User{} = user, recipient, invite_url_fun)
      when is_binary(recipient) and is_function(invite_url_fun, 1) do
    normalized_recipient = normalize_invite_recipient(recipient)

    with {:ok, %{token: serialized_value}} <-
           issue_contact_invite_token(user, normalized_recipient) do
      UserNotifier.deliver_contact_invite_instructions(
        user,
        normalized_recipient,
        invite_url_fun.(serialized_value)
      )
    end
  end

  @doc """
  Delivers phone verification instructions to the given user.
  """
  @spec deliver_phone_verification_instructions(User.t(), term()) ::
          :ok | {:error, :invalid_phone_number | :phone_number_not_found | changeset() | term()}
  def deliver_phone_verification_instructions(%User{} = user, raw_phone_number) do
    with {:ok, %{token: serialized_value, phone_number: phone_number}} <-
           issue_phone_verification_token(user, raw_phone_number) do
      # This slice intentionally delivers the persisted serialized token over SMS.
      PhoneNotifier.deliver_phone_verification_instructions(phone_number, serialized_value,
        user_id: user.id
      )
    end
  end

  @doc """
  Deletes the signed access token.
  """
  @spec delete_user_session_token(String.t()) :: :ok
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

  defp upsert_contact_entry_row(user, contact_client_id, contact_name, birthday) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    Repo.insert(
      %UserContactEntry{
        user_id: user.id,
        contact_client_id: contact_client_id,
        contact_name: contact_name,
        birthday: birthday
      },
      on_conflict: [set: [contact_name: contact_name, birthday: birthday, updated_at: now]],
      conflict_target: [:user_id, :contact_client_id],
      returning: true
    )
  end

  defp sync_contact_entry_emails(contact_entry_id, normalized_emails) do
    desired_email_ids =
      normalized_emails
      |> Enum.map(&find_or_create_email_address_id/1)
      |> Enum.uniq()

    if desired_email_ids == [] do
      Repo.delete_all(
        from(join in UserContactEntryEmailAddress,
          where: join.user_contact_entry_id == ^contact_entry_id
        )
      )
    else
      Repo.delete_all(
        from(join in UserContactEntryEmailAddress,
          where:
            join.user_contact_entry_id == ^contact_entry_id and
              join.email_address_id not in ^desired_email_ids
        )
      )
    end

    Enum.each(desired_email_ids, fn email_address_id ->
      Repo.insert(
        %UserContactEntryEmailAddress{
          user_contact_entry_id: contact_entry_id,
          email_address_id: email_address_id
        },
        on_conflict: :nothing,
        conflict_target: [:user_contact_entry_id, :email_address_id]
      )
    end)

    :ok
  end

  defp sync_contact_entry_phone_numbers(contact_entry_id, normalized_phone_numbers) do
    desired_phone_number_ids =
      normalized_phone_numbers
      |> Enum.map(&find_or_create_phone_number_id/1)
      |> Enum.uniq()

    if desired_phone_number_ids == [] do
      Repo.delete_all(
        from(join in UserContactEntryPhoneNumber,
          where: join.user_contact_entry_id == ^contact_entry_id
        )
      )
    else
      Repo.delete_all(
        from(join in UserContactEntryPhoneNumber,
          where:
            join.user_contact_entry_id == ^contact_entry_id and
              join.phone_number_id not in ^desired_phone_number_ids
        )
      )
    end

    Enum.each(desired_phone_number_ids, fn phone_number_id ->
      Repo.insert(
        %UserContactEntryPhoneNumber{
          user_contact_entry_id: contact_entry_id,
          phone_number_id: phone_number_id
        },
        on_conflict: :nothing,
        conflict_target: [:user_contact_entry_id, :phone_number_id]
      )
    end)

    :ok
  end

  defp find_or_create_email_address_id(normalized_email) do
    Repo.insert(
      %EmailAddress{normalized_email: normalized_email},
      on_conflict: :nothing,
      conflict_target: :normalized_email
    )

    Repo.get_by!(EmailAddress, normalized_email: normalized_email).id
  end

  defp find_or_create_phone_number_id(normalized_phone_number) do
    Repo.insert(
      %PhoneNumber{normalized_e164: normalized_phone_number},
      on_conflict: :nothing,
      conflict_target: :normalized_e164
    )

    Repo.get_by!(PhoneNumber, normalized_e164: normalized_phone_number).id
  end

  defp preload_contact_entry(contact_entry),
    do: Repo.preload(contact_entry, [:email_addresses, :phone_numbers])

  defp user_contact_entries_query(user_id) do
    from(contact_entry in UserContactEntry,
      where: contact_entry.user_id == ^user_id,
      order_by: [asc: contact_entry.inserted_at, asc: contact_entry.id]
    )
  end

  defp user_contact_entry_by_id_query(user_id, contact_entry_id) do
    from(contact_entry in UserContactEntry,
      where: contact_entry.user_id == ^user_id and contact_entry.id == ^contact_entry_id
    )
  end

  defp build_contact_match(owner_id, contact_entry) do
    %{
      id: contact_entry.id,
      contact_entry: contact_entry,
      matched_users: matched_users_for_contact_entry(owner_id, contact_entry)
    }
  end

  defp matched_users_for_contact_entry(owner_id, contact_entry) do
    email_address_ids = Enum.map(contact_entry.email_addresses, & &1.id)
    phone_number_ids = Enum.map(contact_entry.phone_numbers, & &1.id)

    # Contact matching can hit through either identifier family. Merge both result sets and
    # de-duplicate by user id so one user only appears once even if multiple identifiers match.
    (matched_users_by_email(owner_id, email_address_ids) ++
       matched_users_by_phone(owner_id, phone_number_ids))
    |> Enum.uniq_by(& &1.id)
    |> Enum.sort_by(& &1.id)
    |> Enum.map(&hydrate_loaded_user/1)
  end

  defp matched_users_by_email(_owner_id, []), do: []

  defp matched_users_by_email(owner_id, email_address_ids) do
    from(user in User,
      join: user_email_address in UserEmailAddress,
      on: user_email_address.user_id == user.id,
      where: user.id != ^owner_id and user_email_address.email_address_id in ^email_address_ids,
      distinct: user.id
    )
    |> Repo.all()
  end

  defp matched_users_by_phone(_owner_id, []), do: []

  defp matched_users_by_phone(owner_id, phone_number_ids) do
    from(user in User,
      join: user_phone_number in UserPhoneNumber,
      on: user_phone_number.user_id == user.id,
      where: user.id != ^owner_id and user_phone_number.phone_number_id in ^phone_number_ids,
      distinct: user.id
    )
    |> Repo.all()
  end

  defp fetch_attr(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end

  defp normalize_contact_client_id(value) when is_binary(value) and byte_size(value) > 0,
    do: {:ok, value}

  defp normalize_contact_client_id(_value), do: {:error, :invalid_contact_client_id}

  defp normalize_contact_name(value) when is_binary(value), do: {:ok, String.trim(value)}
  defp normalize_contact_name(nil), do: {:ok, nil}
  defp normalize_contact_name(_value), do: {:ok, nil}

  defp normalize_contact_birthday(%Date{} = birthday), do: {:ok, birthday}
  defp normalize_contact_birthday(nil), do: {:ok, nil}

  defp normalize_contact_birthday(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, birthday} -> {:ok, birthday}
      {:error, _reason} -> {:error, :invalid_birthday}
    end
  end

  defp normalize_contact_birthday(_value), do: {:error, :invalid_birthday}

  defp normalize_contact_emails(values) when is_list(values) do
    values
    |> Enum.reduce_while({:ok, []}, fn value, {:ok, acc} ->
      case value do
        raw when is_binary(raw) ->
          normalized_email = raw |> String.trim() |> String.downcase()

          if normalized_email == "" do
            {:cont, {:ok, acc}}
          else
            {:cont, {:ok, [normalized_email | acc]}}
          end

        _ ->
          {:halt, {:error, :invalid_email_list}}
      end
    end)
    |> case do
      {:ok, normalized_emails} -> {:ok, normalized_emails |> Enum.reverse() |> Enum.uniq()}
      {:error, _reason} = error -> error
    end
  end

  defp normalize_contact_emails(_values), do: {:error, :invalid_email_list}

  @spec normalize_invite_recipient(String.t()) :: String.t()
  defp normalize_invite_recipient(recipient) when is_binary(recipient) do
    recipient
    |> String.trim()
    |> String.downcase()
  end

  defp normalize_contact_phone_numbers(values) when is_list(values) do
    values
    |> Enum.reduce_while({:ok, []}, fn value, {:ok, acc} ->
      with true <- is_binary(value),
           {:ok, normalized_phone_number} <- normalize_phone_number(value) do
        {:cont, {:ok, [normalized_phone_number | acc]}}
      else
        _ -> {:halt, {:error, :invalid_phone_number}}
      end
    end)
    |> case do
      {:ok, normalized_phone_numbers} ->
        {:ok, normalized_phone_numbers |> Enum.reverse() |> Enum.uniq()}

      {:error, _reason} = error ->
        error
    end
  end

  defp normalize_contact_phone_numbers(_values), do: {:error, :invalid_phone_number}

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

  @spec user_has_phone_number?(pos_integer(), String.t()) :: boolean()
  defp user_has_phone_number?(user_id, normalized_phone_number) do
    from(user_phone_number in UserPhoneNumber,
      join: phone_number in assoc(user_phone_number, :phone_number),
      where:
        user_phone_number.user_id == ^user_id and
          phone_number.normalized_e164 == ^normalized_phone_number,
      select: 1
    )
    |> Repo.exists?()
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
