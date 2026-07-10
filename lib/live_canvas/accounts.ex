defmodule LC.Accounts do
  @moduledoc """
  The Accounts context.
  """

  use Boundary,
    deps: [LC.Infra, LCSchemas],
    exports: [Scope, Tokens]

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [add_error: 3, change: 2, get_field: 2, put_change: 3]

  alias LC.Infra.{DataGovernance, Repo}
  alias LCSchemas.Accounts.AuthEvent, as: AuthEventSchema
  alias LCSchemas.Infra.AccountDeletionRequest, as: AccountDeletionRequestSchema
  alias LCSchemas.Infra.DataExportRequest, as: DataExportRequestSchema

  alias LCSchemas.Accounts.{
    EmailAddress,
    PhoneNumber,
    StaffPermission,
    User,
    UserContactEntry,
    UserContactEntryEmailAddress,
    UserContactEntryPhoneNumber,
    UserEmailAddress,
    UserIdentity,
    UserPasskey,
    UserPhoneNumber,
    UserToken
  }

  alias LC.Accounts.{
    AuthEvent,
    Passwords,
    Passkeys,
    ProviderAuth,
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
          | :password_reset_token
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
          required(:invite_recipient) => String.t() | nil,
          required(:matched_users) => [User.t()]
        }
  @type user_session_result :: {User.t(), DateTime.t()} | nil
  @type access_token_auth_error :: :invalid_token | :expired_token | :revoked_token
  @type access_token_auth_result :: {:ok, Scope.t()} | {:error, access_token_auth_error()}
  @type refresh_token_auth_error :: :invalid_token | :expired_token | :revoked_token
  @type refresh_token_auth_result :: {:ok, Scope.t()} | {:error, refresh_token_auth_error()}
  @typep token_auth_result :: {:ok, Scope.t()} | {:error, access_token_auth_error()}
  @type auth_event_type :: LCSchemas.Accounts.auth_event_type()
  @type auth_event_opts ::
          [
            user: User.t() | nil,
            user_id: pos_integer() | nil,
            metadata: map()
          ]
  @type auth_event_result :: {:ok, AuthEventSchema.t()} | {:error, changeset()}
  @type data_export_request_result ::
          {:ok, DataExportRequestSchema.t()} | {:error, changeset() | :enqueue_failed}
  @type data_export_request_opts ::
          [{:format, LCSchemas.Infra.data_export_request_format()}]
  @type account_deletion_request_result ::
          {:ok, AccountDeletionRequestSchema.t()} | {:error, changeset() | :enqueue_failed}
  @type account_deletion_request_opts ::
          [{:grace_period_seconds, non_neg_integer()} | {:job_max_attempts, pos_integer()}]
  @type account_deletion_cancel_error :: :not_found | :already_processing | :cannot_cancel
  @type account_deletion_cancel_result ::
          {:ok, AccountDeletionRequestSchema.t()}
          | {:error, account_deletion_cancel_error() | changeset()}
  @type token_pair_payload :: %{access_token: token_payload(), refresh_token: token_payload()}
  @type token_pair_result :: {:ok, token_pair_payload()} | {:error, refresh_token_auth_error()}
  @type auth_entry_payload :: %{
          user: User.t(),
          access_token: token_payload(),
          refresh_token: token_payload()
        }
  @sign_in_identity_providers [:apple_provider, :google_provider, :passkey_provider]
  @type auth_provider :: :google | :apple | :passkey
  @type auth_entry_error ::
          :email_taken
          | :invalid_credentials
          | :passkey_verification_failed
          | :provider_verification_failed
          | :token_expired
          | :token_revoked
          | changeset()
  @type auth_entry_result :: {:ok, auth_entry_payload()} | {:error, auth_entry_error()}
  @type auth_challenge_purpose :: :sign_up | :log_in
  @type magic_link_challenge_payload :: %{user: User.t() | nil, dispatched: boolean()}
  @type magic_link_challenge_result ::
          {:ok, magic_link_challenge_payload()}
          | {:error, :email_taken | :invalid_credentials | changeset()}
  @type passkey_challenge_payload :: %{
          required(:challenge_token) => String.t(),
          required(:dispatched) => boolean(),
          required(:payload_json) => String.t(),
          required(:user) => User.t()
        }
  @type passkey_challenge_result ::
          {:ok, passkey_challenge_payload()}
          | {:error,
             :email_taken | :invalid_credentials | :passkey_verification_failed | changeset()}
  @type password_reset_result ::
          {:ok, {User.t(), [UserToken.t()]}} | {:error, :not_found | changeset()}
  @type registration_attrs :: %{
          optional(:email | :password | String.t()) => String.t()
        }
  @type email_change_attrs :: %{
          optional(:email | String.t()) => String.t()
        }
  @type password_change_attrs :: %{
          optional(:password | :password_confirmation | String.t()) => String.t()
        }
  @type suspension_result :: user_result()
  @type unlink_user_identity_error ::
          :not_found | :already_revoked | :last_sign_in_method | changeset()
  @type unlink_user_identity_result ::
          {:ok, UserIdentity.t()} | {:error, unlink_user_identity_error()}
  @type staff_permission :: LCSchemas.Accounts.staff_permission()
  @type staff_permission_result ::
          {:ok, StaffPermission.t()} | {:error, changeset() | :not_found}

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

    if Passwords.valid_password?(user, password) and active_user?(user) do
      emit_auth_event(:password_login_succeeded,
        user: user,
        metadata: %{"method" => "password"}
      )

      user
    else
      emit_auth_event(:password_login_failed,
        user: user,
        metadata: %{"method" => "password", "reason" => "invalid_credentials"}
      )

      nil
    end
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
  Returns one active identity row owned by the given user.
  """
  @spec get_active_user_identity(User.t(), integer()) :: UserIdentity.t() | nil
  def get_active_user_identity(%User{id: user_id}, identity_id)
      when is_integer(identity_id) do
    user_id
    |> active_user_identity_by_id_query(identity_id)
    |> Repo.one()
  end

  def get_active_user_identity(%User{}, _identity_id), do: nil

  @doc """
  Returns a deterministic query for a user's linked identities.
  """
  @spec user_identities_query(User.t()) :: Ecto.Query.t()
  def user_identities_query(%User{id: user_id}) do
    from(user_identity in UserIdentity,
      where: user_identity.user_id == ^user_id and is_nil(user_identity.revoked_at),
      order_by: [asc: user_identity.inserted_at, asc: user_identity.id]
    )
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  @doc """
  Persists an append-only auth security event.
  """
  @spec record_auth_event(auth_event_type(), auth_event_opts()) :: auth_event_result()
  def record_auth_event(event_type, opts \\ []) when is_atom(event_type) and is_list(opts) do
    event_type
    |> AuthEvent.attrs_for_insert(opts)
    |> persist_auth_event()
  end

  @doc """
  Lists auth security events for a user, newest first.
  """
  @spec list_user_auth_events(User.t(), keyword()) :: [AuthEventSchema.t()]
  def list_user_auth_events(%User{id: user_id}, opts \\ []) when is_list(opts) do
    limit = opts |> Keyword.get(:limit, 50) |> normalize_query_limit()

    from(auth_event in AuthEventSchema,
      where: auth_event.user_id == ^user_id,
      order_by: [desc: auth_event.inserted_at, desc: auth_event.id],
      limit: ^limit
    )
    |> Repo.all()
  end

  @doc """
  Creates or reuses an active data export request for the viewer.
  """
  @spec request_user_data_export(User.t(), data_export_request_opts()) ::
          data_export_request_result()
  def request_user_data_export(%User{} = user, opts \\ []) when is_list(opts) do
    DataGovernance.request_data_export(user, opts)
  end

  @doc """
  Lists viewer-owned data export requests, newest first.
  """
  @spec list_user_data_export_requests(User.t()) :: [DataExportRequestSchema.t()]
  def list_user_data_export_requests(%User{} = user) do
    DataGovernance.list_data_export_requests(user)
  end

  @doc """
  Gets a viewer-owned data export request by local ID.
  """
  @spec get_user_data_export_request(User.t(), integer()) :: DataExportRequestSchema.t() | nil
  def get_user_data_export_request(%User{} = user, request_id)
      when is_integer(request_id) do
    DataGovernance.get_data_export_request(user, request_id)
  end

  @doc """
  Creates or reuses an active account deletion request for the viewer.
  """
  @spec request_user_account_deletion(User.t(), account_deletion_request_opts()) ::
          account_deletion_request_result()
  def request_user_account_deletion(%User{} = user, opts \\ []) when is_list(opts) do
    DataGovernance.request_account_deletion(user, opts)
  end

  @doc """
  Lists viewer-owned account deletion requests, newest first.
  """
  @spec list_user_account_deletion_requests(User.t()) :: [AccountDeletionRequestSchema.t()]
  def list_user_account_deletion_requests(%User{} = user) do
    DataGovernance.list_account_deletion_requests(user)
  end

  @doc """
  Gets a viewer-owned account deletion request by local ID.
  """
  @spec get_user_account_deletion_request(User.t(), integer()) ::
          AccountDeletionRequestSchema.t() | nil
  def get_user_account_deletion_request(%User{} = user, request_id)
      when is_integer(request_id) do
    DataGovernance.get_account_deletion_request(user, request_id)
  end

  @doc """
  Cancels a viewer-owned account deletion request when still cancelable.
  """
  @spec cancel_user_account_deletion_request(User.t(), pos_integer()) ::
          account_deletion_cancel_result()
  def cancel_user_account_deletion_request(%User{} = user, request_id)
      when is_integer(request_id) and request_id > 0 do
    DataGovernance.cancel_account_deletion_request(user, request_id)
  end

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

  @doc """
  Registers a password-backed account and immediately returns an auth token pair.
  """
  @spec sign_up_with_password(map()) :: auth_entry_result()
  def sign_up_with_password(attrs) when is_map(attrs) do
    email_changeset = UserChanges.email_changeset(%User{}, attrs)
    email = get_field(email_changeset, :email)

    Repo.transact(fn ->
      cond do
        not email_changeset.valid? ->
          {:error, email_changeset}

        email_taken?(email) ->
          {:error, :email_taken}

        true ->
          with {:ok, user} <- Repo.insert(email_changeset),
               {:ok, _user_email_address} <- attach_email_address(user, email, []),
               {:ok, user_with_password} <-
                 user
                 |> UserChanges.password_changeset(attrs)
                 |> Repo.update(),
               {:ok, auth_entry} <- issue_auth_entry_tokens(put_primary_email(user_with_password)) do
            {:ok, auth_entry}
          end
      end
    end)
  end

  def sign_up_with_password(_attrs), do: {:error, :invalid_credentials}

  @doc """
  Issues an auth token pair for a valid email/password login.
  """
  @spec log_in_with_password(map()) :: auth_entry_result()
  def log_in_with_password(%{email: email, password: password})
      when is_binary(email) and is_binary(password) do
    case get_user_by_email_and_password(email, password) do
      %User{} = user ->
        Repo.transact(fn ->
          issue_auth_entry_tokens(user)
        end)

      nil ->
        {:error, :invalid_credentials}
    end
  end

  def log_in_with_password(_attrs), do: {:error, :invalid_credentials}

  @doc """
  Begins a reusable magic-link challenge for signup or login.
  """
  @spec begin_magic_link_challenge(auth_challenge_purpose(), String.t(), (String.t() ->
                                                                            String.t())) ::
          magic_link_challenge_result()
  def begin_magic_link_challenge(purpose, email, magic_link_url_fun)
      when purpose in [:sign_up, :log_in] and is_binary(email) and
             is_function(magic_link_url_fun, 1) do
    email_changeset = UserChanges.email_changeset(%User{}, %{email: email})
    normalized_email = get_field(email_changeset, :email)

    cond do
      not email_changeset.valid? ->
        {:error, email_changeset}

      purpose == :sign_up ->
        begin_magic_link_sign_up(normalized_email, magic_link_url_fun)

      true ->
        begin_magic_link_log_in(normalized_email, magic_link_url_fun)
    end
  end

  def begin_magic_link_challenge(_purpose, _email, _magic_link_url_fun),
    do: {:error, :invalid_credentials}

  @doc """
  Begins a reusable passkey challenge for signup or login.

  The serialized token embeds the raw secret that the passkey adapter reuses as
  the WebAuthn challenge bytes, so challenge issuance stays one-table and
  replay-safe without adding a second persistence model.
  """
  @spec begin_passkey_challenge(auth_challenge_purpose(), String.t()) ::
          passkey_challenge_result()
  def begin_passkey_challenge(purpose, email)
      when purpose in [:sign_up, :log_in] and is_binary(email) do
    email_changeset = UserChanges.email_changeset(%User{}, %{email: email})
    normalized_email = get_field(email_changeset, :email)

    cond do
      not email_changeset.valid? ->
        {:error, email_changeset}

      purpose == :sign_up ->
        begin_passkey_sign_up(normalized_email)

      true ->
        begin_passkey_log_in(normalized_email)
    end
  end

  def begin_passkey_challenge(_purpose, _email), do: {:error, :invalid_credentials}

  @doc """
  Completes magic-link signup and returns auth tokens.
  """
  @spec sign_up_with_magic_link(String.t()) :: auth_entry_result()
  def sign_up_with_magic_link(serialized_value) when is_binary(serialized_value) do
    complete_magic_link_auth(serialized_value)
  end

  def sign_up_with_magic_link(_serialized_value), do: {:error, :invalid_credentials}

  @doc """
  Completes passkey signup and returns auth tokens.
  """
  @spec sign_up_with_passkey(map()) :: auth_entry_result()
  def sign_up_with_passkey(attrs) when is_map(attrs) do
    Repo.transact(fn ->
      with {:ok, {user, challenge_token, raw_secret}} <-
             fetch_passkey_challenge(
               fetch_attr(attrs, :challenge_token),
               :passkey_registration_challenge_token
             ),
           {:ok, verified_passkey} <- Passkeys.verify_registration(attrs, raw_secret),
           :ok <- ensure_passkey_credential_available(verified_passkey.credential_id),
           {:ok, confirmed_user} <- confirm_user(user),
           {:ok, identity} <- persist_passkey_identity(confirmed_user, verified_passkey),
           {:ok, _user_passkey} <-
             persist_user_passkey(confirmed_user, identity, verified_passkey),
           :ok <- revoke_user_token(challenge_token, strict: true),
           {:ok, auth_entry} <- issue_auth_entry_tokens(confirmed_user) do
        {:ok, auth_entry}
      else
        {:error, :expired_token} ->
          {:error, :token_expired}

        {:error, :revoked_token} ->
          {:error, :token_revoked}

        {:error, :invalid_token} ->
          {:error, :invalid_credentials}

        {:error, :provider_identity_exists} ->
          {:error, :passkey_verification_failed}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:error, changeset}

        {:error, reason}
        when reason in [:email_taken, :invalid_credentials, :passkey_verification_failed] ->
          {:error, reason}
      end
    end)
  end

  def sign_up_with_passkey(_attrs), do: {:error, :invalid_credentials}

  @doc """
  Completes magic-link login and returns auth tokens.
  """
  @spec log_in_with_magic_link(String.t()) :: auth_entry_result()
  def log_in_with_magic_link(serialized_value) when is_binary(serialized_value) do
    complete_magic_link_auth(serialized_value)
  end

  def log_in_with_magic_link(_serialized_value), do: {:error, :invalid_credentials}

  @doc """
  Completes passkey login and returns auth tokens.
  """
  @spec log_in_with_passkey(map()) :: auth_entry_result()
  def log_in_with_passkey(attrs) when is_map(attrs) do
    Repo.transact(fn ->
      with {:ok, {user, challenge_token, raw_secret}} <-
             fetch_passkey_challenge(
               fetch_attr(attrs, :challenge_token),
               :passkey_authentication_challenge_token
             ),
           credential_id when is_binary(credential_id) <- fetch_attr(attrs, :credential_id),
           %UserPasskey{} = user_passkey <- active_user_passkey(user.id, credential_id),
           true <- active_user?(user),
           {:ok, %{sign_count: sign_count}} <-
             Passkeys.verify_authentication(attrs, user_passkey, raw_secret),
           {:ok, _updated_passkey} <- touch_user_passkey(user_passkey, sign_count),
           %UserIdentity{} = identity <-
             get_active_user_identity(user, user_passkey.user_identity_id),
           {:ok, _updated_identity} <- touch_provider_identity(identity, identity.provider_data),
           :ok <- revoke_user_token(challenge_token, strict: true),
           {:ok, auth_entry} <- issue_auth_entry_tokens(user) do
        {:ok, auth_entry}
      else
        {:error, :expired_token} ->
          {:error, :token_expired}

        {:error, :revoked_token} ->
          {:error, :token_revoked}

        {:error, :invalid_token} ->
          {:error, :invalid_credentials}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:error, changeset}

        {:error, :passkey_verification_failed} = error ->
          error

        nil ->
          {:error, :invalid_credentials}

        false ->
          {:error, :invalid_credentials}

        _other ->
          {:error, :invalid_credentials}
      end
    end)
  end

  def log_in_with_passkey(_attrs), do: {:error, :invalid_credentials}

  @doc """
  Registers a Google or Apple-backed account and returns an auth token pair.
  """
  @spec sign_up_with_provider(auth_provider(), String.t()) :: auth_entry_result()
  def sign_up_with_provider(provider, id_token)
      when provider in [:google, :apple] and is_binary(id_token) do
    with {:ok, verified_identity} <- ProviderAuth.verify(provider, id_token) do
      Repo.transact(fn ->
        with :ok <- ensure_provider_identity_available(verified_identity),
             {:ok, user} <- create_provider_user(verified_identity.email),
             {:ok, _identity} <- persist_provider_identity(user, verified_identity),
             {:ok, auth_entry} <- issue_auth_entry_tokens(user) do
          {:ok, auth_entry}
        else
          {:error, :provider_identity_exists} ->
            {:error, :provider_verification_failed}

          {:error, :email_taken} ->
            {:error, :email_taken}

          {:error, %Ecto.Changeset{} = changeset} ->
            {:error, changeset}
        end
      end)
    end
  end

  def sign_up_with_provider(_provider, _id_token), do: {:error, :provider_verification_failed}

  @doc """
  Issues an auth token pair for a valid Google or Apple login.
  """
  @spec log_in_with_provider(auth_provider(), String.t()) :: auth_entry_result()
  def log_in_with_provider(provider, id_token)
      when provider in [:google, :apple] and is_binary(id_token) do
    with {:ok, verified_identity} <- ProviderAuth.verify(provider, id_token) do
      Repo.transact(fn ->
        with %UserIdentity{} = identity <- active_provider_identity(verified_identity),
             %User{} = user <- get_user!(identity.user_id),
             true <- active_user?(user),
             {:ok, _identity} <-
               touch_provider_identity(identity, verified_identity.provider_data),
             {:ok, auth_entry} <- issue_auth_entry_tokens(user) do
          {:ok, auth_entry}
        else
          {:error, %Ecto.Changeset{} = changeset} ->
            {:error, changeset}

          _other ->
            {:error, :provider_verification_failed}
        end
      end)
    end
  end

  def log_in_with_provider(_provider, _id_token), do: {:error, :provider_verification_failed}

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
  Applies a moderation suspension timestamp to the user.
  """
  @spec suspend_user(User.t()) :: suspension_result()
  def suspend_user(%User{} = user) do
    case user
         |> fresh_user!()
         |> UserChanges.suspend_changeset(now_utc())
         |> Repo.update() do
      {:ok, suspended_user} -> {:ok, hydrate_loaded_user(suspended_user)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Clears moderation suspension state from the user.
  """
  @spec unsuspend_user(User.t()) :: suspension_result()
  def unsuspend_user(%User{} = user) do
    case user
         # Refresh first so clearing suspension works even when callers pass
         # a stale pre-suspension struct from earlier in the request lifecycle.
         |> fresh_user!()
         |> UserChanges.unsuspend_changeset()
         |> Repo.update() do
      {:ok, unsuspended_user} -> {:ok, hydrate_loaded_user(unsuspended_user)}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Returns whether the user is currently suspended.
  """
  @spec suspended?(User.t()) :: boolean()
  def suspended?(%User{id: user_id}) when is_integer(user_id) do
    from(user in User,
      where: user.id == ^user_id and not is_nil(user.suspended_at),
      select: 1
    )
    |> Repo.exists?()
  end

  @doc """
  Updates the user's primary email using the given verification token.
  """
  @spec update_user_email(User.t(), String.t()) ::
          {:ok, User.t()} | {:error, :transaction_aborted}
  def update_user_email(user, serialized_value) do
    current_email = current_email_for_user(user.id)

    result =
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
                   where:
                     token.user_id == ^user.id and token.context == ^:email_verification_token
                 )
               ) do
          {:ok, updated_user}
        else
          _ -> {:error, :transaction_aborted}
        end
      end)

    case result do
      {:ok, %User{id: user_id}} ->
        emit_auth_event(:email_change_succeeded,
          user_id: user_id,
          metadata: %{"method" => "email_verification_token"}
        )

      {:error, :transaction_aborted} ->
        emit_auth_event(:email_change_failed,
          user_id: user.id,
          metadata: %{"reason" => "transaction_aborted"}
        )

      _ ->
        :ok
    end

    result
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
    result =
      user
      |> UserChanges.password_changeset(attrs)
      |> update_user_and_delete_all_tokens()

    case result do
      {:ok, {%User{id: user_id}, _expired_tokens}} ->
        emit_auth_event(:password_change_succeeded,
          user_id: user_id,
          metadata: %{"method" => "password"}
        )

      {:error, %Ecto.Changeset{}} ->
        emit_auth_event(:password_change_failed,
          user_id: user.id,
          metadata: %{"reason" => "validation_failed"}
        )

      _ ->
        :ok
    end

    result
  end

  @doc """
  Creates a scope for the given user.
  """
  @spec scope_for_user(User.t() | nil) :: Scope.t() | nil
  def scope_for_user(%User{} = user) do
    staff_permissions =
      user
      |> list_active_staff_permissions()
      |> Enum.map(& &1.permission)

    Scope.for_user(user, staff_permissions)
  end

  def scope_for_user(nil), do: nil

  @doc """
  Returns the empty scope used by adapter layers.
  """
  @spec empty_scope() :: nil
  def empty_scope, do: nil

  @doc """
  Grants a staff permission to a user.

  If the user already has an active grant for the permission, returns that row.
  """
  @spec grant_staff_permission(User.t(), staff_permission()) :: staff_permission_result()
  def grant_staff_permission(%User{id: user_id}, permission)
      when is_integer(user_id) and user_id > 0 do
    case active_staff_permission(user_id, permission) do
      %StaffPermission{} = staff_permission ->
        {:ok, staff_permission}

      nil ->
        %StaffPermission{}
        |> StaffPermission.changeset(%{
          user_id: user_id,
          permission: permission,
          granted_at: now_utc()
        })
        |> Repo.insert()
        |> handle_staff_permission_grant_insert(user_id, permission)
    end
  end

  @doc """
  Revokes an active staff permission for a user.
  """
  @spec revoke_staff_permission(User.t(), staff_permission()) :: staff_permission_result()
  def revoke_staff_permission(%User{id: user_id}, permission)
      when is_integer(user_id) and user_id > 0 do
    case active_staff_permission(user_id, permission) do
      %StaffPermission{} = staff_permission ->
        staff_permission
        |> change(revoked_at: now_utc())
        |> Repo.update()

      nil ->
        {:error, :not_found}
    end
  end

  @doc """
  Lists active staff permissions for a user.
  """
  @spec list_active_staff_permissions(User.t()) :: [StaffPermission.t()]
  def list_active_staff_permissions(%User{id: user_id})
      when is_integer(user_id) and user_id > 0 do
    user_id
    |> active_staff_permissions_query()
    |> Repo.all()
  end

  def list_active_staff_permissions(%User{}), do: []

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
  Persists and returns a refresh token payload for the given user.
  """
  @spec issue_refresh_token(User.t(), keyword()) :: token_result()
  def issue_refresh_token(%User{} = user, attrs \\ []) do
    issue_user_token(user, :refresh_token, attrs)
  end

  @doc """
  Persists and returns a magic link token payload for the given user.
  """
  @spec issue_magic_link_token(User.t()) :: token_result()
  def issue_magic_link_token(%User{} = user) do
    issue_user_token(user, :email_magic_link_token, sent_to: user.email)
  end

  @spec issue_passkey_registration_challenge_token(User.t()) :: token_result()
  defp issue_passkey_registration_challenge_token(%User{} = user) do
    issue_user_token(user, :passkey_registration_challenge_token, sent_to: user.email)
  end

  @spec issue_passkey_authentication_challenge_token(User.t()) :: token_result()
  defp issue_passkey_authentication_challenge_token(%User{} = user) do
    issue_user_token(user, :passkey_authentication_challenge_token, sent_to: user.email)
  end

  @doc """
  Persists and returns a password reset token payload for the given user.
  """
  @spec issue_password_reset_token(User.t()) :: token_result()
  def issue_password_reset_token(%User{} = user) do
    issue_user_token(user, :password_reset_token, sent_to: user.email)
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
  Revokes a viewer-owned identity by local ID.
  """
  @spec unlink_user_identity(User.t(), pos_integer()) :: unlink_user_identity_result()
  def unlink_user_identity(%User{id: user_id} = user, identity_id)
      when is_integer(identity_id) and identity_id > 0 do
    result =
      Repo.transact(fn ->
        # Serialize unlink checks per user so concurrent requests cannot both
        # observe the same provider as removable and revoke the final sign-in method.
        persisted_user =
          from(candidate in User, where: candidate.id == ^user_id, lock: "FOR UPDATE")
          |> Repo.one()

        user_identity =
          user_id
          |> user_identity_by_id_query(identity_id)
          |> Repo.one()

        with %User{} <- persisted_user,
             %UserIdentity{} = active_identity <- active_identity(user_identity),
             true <- identity_unlinkable?(persisted_user, active_identity) do
          revoke_identity_if_active(active_identity)
        else
          nil -> {:error, :not_found}
          {:error, reason} -> {:error, reason}
          false -> {:error, :last_sign_in_method}
        end
      end)

    emit_unlink_identity_auth_event(result, user)
    result
  end

  def unlink_user_identity(%User{} = user, _identity_id) do
    result = {:error, :not_found}
    emit_unlink_identity_auth_event(result, user)
    result
  end

  @doc """
  Returns whether an active viewer-owned identity can be removed without deleting the
  user's final password or provider sign-in method.

  This value is a presentation hint only; `unlink_user_identity/2` rechecks the same
  invariant while holding a lock on the user row.
  """
  @spec user_identity_unlinkable?(User.t(), pos_integer()) :: boolean()
  def user_identity_unlinkable?(%User{id: user_id}, identity_id)
      when is_integer(user_id) and is_integer(identity_id) and identity_id > 0 do
    with %User{} = persisted_user <- Repo.get(User, user_id),
         %UserIdentity{} = user_identity <-
           user_id
           |> active_user_identity_by_id_query(identity_id)
           |> Repo.one() do
      identity_unlinkable?(persisted_user, user_identity)
    else
      _other -> false
    end
  end

  def user_identity_unlinkable?(%User{}, _identity_id), do: false

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
    contact_entries =
      user.id
      |> user_contact_entries_query()
      |> Repo.all()
      |> Repo.preload([:email_addresses, :phone_numbers])

    owner_email_address_ids = owner_email_address_ids(user.id)

    Enum.map(
      contact_entries,
      &build_contact_match(user.id, owner_email_address_ids, &1)
    )
  end

  @doc """
  Returns one viewer-owned contact match by contact entry id.
  """
  @spec get_user_contact_match(User.t(), integer()) :: contact_match() | nil
  def get_user_contact_match(%User{} = user, contact_entry_id)
      when is_integer(contact_entry_id) do
    user.id
    |> user_contact_entry_by_id_query(contact_entry_id)
    |> Repo.one()
    |> case do
      nil ->
        nil

      contact_entry ->
        build_contact_match(
          user.id,
          owner_email_address_ids(user.id),
          preload_contact_entry(contact_entry)
        )
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
         true <- Tokens.valid_session_token?(user_token, raw_secret),
         true <- active_user?(user) do
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
         true <- Tokens.valid_magic_link_token?(user_token, raw_secret, hydrated_user.email),
         true <- active_user?(hydrated_user) do
      hydrated_user
    else
      _ -> nil
    end
  end

  @doc """
  Gets the user with the given password reset token.
  """
  @spec get_user_by_password_reset_token(String.t()) :: User.t() | nil
  def get_user_by_password_reset_token(serialized_value) when is_binary(serialized_value) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {user, user_token, current_email} <- Repo.one(query),
         hydrated_user = hydrate_user(user, user_token, current_email),
         true <- Tokens.valid_password_reset_token?(user_token, raw_secret, hydrated_user.email),
         true <- active_user?(hydrated_user) do
      hydrated_user
    else
      _ -> nil
    end
  end

  def get_user_by_password_reset_token(_serialized_value), do: nil

  @doc """
  Logs the user in by magic link.
  """
  @spec login_user_by_magic_link(String.t()) ::
          {:ok, {User.t(), [UserToken.t()]}} | {:error, :not_found | changeset()}
  def login_user_by_magic_link(serialized_value) do
    result =
      with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
           {user, user_token, current_email} <- Repo.one(query),
           hydrated_user = hydrate_user(user, user_token, current_email),
           true <- Tokens.valid_magic_link_token?(user_token, raw_secret, hydrated_user.email),
           true <- active_user?(hydrated_user) do
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
            |> update_user_and_delete_all_tokens(verify_primary_email: true)

          confirmed_user ->
            Repo.delete!(user_token)
            {:ok, {confirmed_user, []}}
        end
      else
        _ -> {:error, :not_found}
      end

    case result do
      {:ok, {logged_in_user, _expired_tokens}} ->
        emit_auth_event(:magic_link_login_succeeded,
          user: logged_in_user,
          metadata: %{"method" => "magic_link"}
        )

      {:error, :not_found} ->
        emit_auth_event(:magic_link_login_failed,
          metadata: %{"method" => "magic_link", "reason" => "not_found"}
        )

      _ ->
        :ok
    end

    result
  end

  @doc """
  Resets a user password from a password reset token.
  """
  @spec reset_user_password(String.t(), password_change_attrs()) :: password_reset_result()
  def reset_user_password(serialized_value, attrs)
      when is_binary(serialized_value) and is_map(attrs) do
    result =
      Repo.transact(fn ->
        with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
             {:ok, {user, user_token, current_email}} <- fetch_token_lookup_row(query),
             hydrated_user = hydrate_user(user, user_token, current_email),
             true <-
               Tokens.valid_password_reset_token?(user_token, raw_secret, hydrated_user.email) ||
                 {:error, :not_found},
             true <- active_user?(hydrated_user) || {:error, :not_found},
             {:ok, {updated_user, expired_tokens}} <-
               hydrated_user
               |> UserChanges.password_changeset(attrs)
               |> update_user_and_delete_all_tokens() do
          {:ok, {updated_user, expired_tokens}}
        else
          # Keep token lookup and freshness failures indistinguishable so callers
          # cannot infer whether a specific reset token ever existed.
          {:error, :revoked_token} -> {:error, :not_found}
          {:error, %Ecto.Changeset{} = changeset} -> {:error, changeset}
          _ -> {:error, :not_found}
        end
      end)

    emit_password_reset_auth_event(result)
    result
  end

  def reset_user_password(_serialized_value, _attrs) do
    result = {:error, :not_found}
    emit_password_reset_auth_event(result)
    result
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
          {:ok, Swoosh.Email.t()} | {:error, :magic_link_not_allowed | changeset()}
  def deliver_login_instructions(%User{} = user, magic_link_url_fun)
      when is_function(magic_link_url_fun, 1) do
    with true <- magic_link_login_allowed?(user) || {:error, :magic_link_not_allowed},
         {:ok, %{token: serialized_value}} <- issue_magic_link_token(user) do
      UserNotifier.deliver_login_instructions(user, magic_link_url_fun.(serialized_value))
    end
  end

  @doc """
  Delivers password reset instructions to the given user.
  """
  @spec deliver_user_reset_password_instructions(User.t(), (String.t() -> String.t())) ::
          {:ok, Swoosh.Email.t()} | {:error, changeset() | term()}
  def deliver_user_reset_password_instructions(%User{} = user, reset_password_url_fun)
      when is_function(reset_password_url_fun, 1) do
    with {:ok, %{token: serialized_value}} <- issue_password_reset_token(user),
         {:ok, _email} = delivery <-
           UserNotifier.deliver_reset_password_instructions(
             user,
             reset_password_url_fun.(serialized_value)
           ) do
      emit_auth_event(:account_recovery_requested,
        user: user,
        metadata: %{"method" => "password_reset_token"}
      )

      delivery
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

  @doc """
  Deletes the signed refresh token.
  """
  @spec revoke_refresh_token(String.t()) :: :ok
  def revoke_refresh_token(serialized_value) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {_user, user_token, _current_email} <- Repo.one(query),
         true <- refresh_token_secret_matches?(user_token, raw_secret),
         :ok <- revoke_user_token(user_token, strict: true) do
      emit_auth_event(:refresh_token_revoked,
        user_id: user_token.user_id,
        metadata: %{"context" => "refresh_token"}
      )
    end

    :ok
  end

  @doc """
  Rotates a valid refresh token into a fresh access/refresh pair.
  """
  @spec rotate_refresh_token(String.t()) :: token_pair_result()
  def rotate_refresh_token(serialized_value) when is_binary(serialized_value) do
    result =
      Repo.transact(fn ->
        with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
             {:ok, {user, user_token, _current_email}} <- fetch_token_lookup_row(query),
             :ok <- validate_refresh_token(user_token, raw_secret),
             true <- active_user?(user) || {:error, :revoked_token},
             # Rotation must consume exactly one refresh token row to enforce
             # single-use refresh semantics even under concurrent requests.
             :ok <- revoke_user_token(user_token, strict: true),
             {:ok, access_token_payload} <- issue_access_token(user),
             {:ok, refresh_token_payload} <- issue_refresh_token(user) do
          {:ok, %{access_token: access_token_payload, refresh_token: refresh_token_payload}}
        else
          :error ->
            {:error, :invalid_token}

          {:error, reason} when reason in [:invalid_token, :expired_token, :revoked_token] ->
            {:error, reason}

          {:error, %Ecto.Changeset{}} ->
            {:error, :invalid_token}
        end
      end)

    emit_refresh_token_rotation_event(result)
    result
  end

  def rotate_refresh_token(_serialized_value) do
    result = {:error, :invalid_token}
    emit_refresh_token_rotation_event(result)
    result
  end

  @doc """
  Authenticates a serialized access token and returns a user scope.

  Error semantics:
  - `:invalid_token`: malformed transport value, wrong context, or secret mismatch.
  - `:expired_token`: valid access token whose freshness window elapsed.
  - `:revoked_token`: token id no longer exists (deleted/revoked) or user is inactive.
  """
  @spec authenticate_access_token(String.t()) :: access_token_auth_result()
  def authenticate_access_token(serialized_value) when is_binary(serialized_value) do
    authenticate_user_token(serialized_value, &validate_access_token/2)
  end

  def authenticate_access_token(_serialized_value), do: {:error, :invalid_token}

  @doc """
  Authenticates a serialized refresh token and returns a user scope.
  """
  @spec authenticate_refresh_token(String.t()) :: refresh_token_auth_result()
  def authenticate_refresh_token(serialized_value) when is_binary(serialized_value) do
    authenticate_user_token(serialized_value, &validate_refresh_token/2)
  end

  def authenticate_refresh_token(_serialized_value), do: {:error, :invalid_token}

  ## Token helper

  defp update_user_and_delete_all_tokens(changeset, opts \\ []) do
    Repo.transact(fn ->
      with {:ok, user} <- Repo.update(changeset),
           {:ok, _user_email_address} <- maybe_verify_primary_email(user, opts) do
        tokens_to_expire =
          Repo.all(from(token in UserToken, where: token.user_id == ^user.id))

        Repo.delete_all(
          from(token in UserToken, where: token.id in ^Enum.map(tokens_to_expire, & &1.id))
        )

        {:ok, {put_primary_email(user), tokens_to_expire}}
      end
    end)
  end

  defp maybe_verify_primary_email(%User{} = user, opts) when is_list(opts) do
    if Keyword.get(opts, :verify_primary_email, false) do
      attach_email_address(user, user.email, verified_at: user.confirmed_at)
    else
      {:ok, nil}
    end
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

        case maybe_mark_email_verified(user_email_address, opts) do
          {:ok, verified_user_email_address} ->
            {:ok, Repo.preload(verified_user_email_address, :email_address)}

          {:error, changeset} ->
            {:error, changeset}
        end

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp maybe_mark_email_verified(%UserEmailAddress{} = user_email_address, opts) do
    case Keyword.get(opts, :verified_at) do
      %DateTime{} = verified_at ->
        user_email_address
        |> change(verified_at: verified_at)
        |> Repo.update()

      _other ->
        {:ok, user_email_address}
    end
  end

  @spec issue_auth_entry_tokens(User.t()) :: {:ok, auth_entry_payload()} | {:error, changeset()}
  defp issue_auth_entry_tokens(%User{} = user) do
    with {:ok, access_token_payload} <- issue_access_token(user),
         {:ok, refresh_token_payload} <- issue_refresh_token(user) do
      {:ok,
       %{
         user: user,
         access_token: access_token_payload,
         refresh_token: refresh_token_payload
       }}
    end
  end

  @spec ensure_provider_identity_available(ProviderAuth.verified_identity()) ::
          :ok | {:error, :provider_identity_exists}
  defp ensure_provider_identity_available(%{provider: provider, provider_uid: provider_uid}) do
    # Provider UIDs stay globally unique even after unlink/revocation, so signup
    # must reject any persisted row here instead of relying on the later insert
    # to surface a database constraint violation.
    if provider_identity_exists?(provider, provider_uid) do
      {:error, :provider_identity_exists}
    else
      :ok
    end
  end

  @spec create_provider_user(String.t()) :: user_result() | {:error, :email_taken}
  defp create_provider_user(email) when is_binary(email) do
    verified_at = now_utc()

    changeset =
      %User{}
      |> UserChanges.email_changeset(%{email: email})
      |> put_change(:confirmed_at, verified_at)

    normalized_email = get_field(changeset, :email)

    cond do
      not changeset.valid? ->
        {:error, changeset}

      email_taken?(normalized_email) ->
        {:error, :email_taken}

      true ->
        with {:ok, user} <- Repo.insert(changeset),
             {:ok, _user_email_address} <-
               attach_email_address(user, normalized_email, verified_at: verified_at) do
          {:ok, put_primary_email(user)}
        end
    end
  end

  @spec persist_provider_identity(User.t(), ProviderAuth.verified_identity()) ::
          {:ok, UserIdentity.t()} | {:error, changeset()}
  defp persist_provider_identity(%User{} = user, verified_identity)
       when is_map(verified_identity) do
    register_user_identity(
      user,
      verified_identity.provider,
      verified_identity.provider_uid,
      provider_data: verified_identity.provider_data,
      last_used_at: now_utc()
    )
  end

  @spec active_provider_identity(ProviderAuth.verified_identity()) :: UserIdentity.t() | nil
  defp active_provider_identity(%{provider: provider, provider_uid: provider_uid}) do
    provider
    |> active_provider_identity_query(provider_uid)
    |> Repo.one()
  end

  @spec touch_provider_identity(UserIdentity.t(), map()) ::
          {:ok, UserIdentity.t()} | {:error, changeset()}
  defp touch_provider_identity(%UserIdentity{} = identity, provider_data)
       when is_map(provider_data) do
    # Provider login must only succeed for an existing linked identity; we refresh
    # metadata here but never use a matching email to implicitly create or link one.
    identity
    |> change(provider_data: provider_data, last_used_at: now_utc())
    |> Repo.update()
  end

  @spec begin_magic_link_sign_up(String.t(), (String.t() -> String.t())) ::
          magic_link_challenge_result()
  defp begin_magic_link_sign_up(email, magic_link_url_fun) do
    case register_user(%{email: email}) do
      {:ok, user} ->
        user = put_primary_email(user)

        # Challenge acceptance should not fork on notifier transport state;
        # callers need a deterministic response while delivery remains best-effort.
        _ = deliver_login_instructions(user, magic_link_url_fun)
        {:ok, %{user: user, dispatched: true}}

      {:error, %Ecto.Changeset{} = changeset} ->
        if email_taken_error?(changeset), do: {:error, :email_taken}, else: {:error, changeset}
    end
  end

  @spec begin_magic_link_log_in(String.t(), (String.t() -> String.t())) ::
          magic_link_challenge_result()
  defp begin_magic_link_log_in(email, magic_link_url_fun) do
    _ =
      case get_user_by_email(email) do
        nil ->
          :ok

        %User{} = user ->
          # Login challenge responses stay uniform so callers cannot enumerate
          # whether a given email is already registered.
          deliver_login_instructions(user, magic_link_url_fun)
      end

    {:ok, %{user: nil, dispatched: true}}
  end

  @spec complete_magic_link_auth(String.t()) :: auth_entry_result()
  defp complete_magic_link_auth(serialized_value) when is_binary(serialized_value) do
    Repo.transact(fn ->
      with {:ok, {user, _expired_tokens}} <- login_user_by_magic_link(serialized_value),
           {:ok, auth_entry} <- issue_auth_entry_tokens(user) do
        {:ok, auth_entry}
      else
        {:error, :not_found} -> {:error, :invalid_credentials}
        {:error, %Ecto.Changeset{} = changeset} -> {:error, changeset}
      end
    end)
  end

  @spec begin_passkey_sign_up(String.t()) :: passkey_challenge_result()
  defp begin_passkey_sign_up(email) do
    case register_user(%{email: email}) do
      {:ok, user} ->
        user = put_primary_email(user)

        Repo.transact(fn ->
          with {:ok, %{token: challenge_token}} <-
                 issue_passkey_registration_challenge_token(user),
               {:ok, payload_json} <- passkey_registration_payload(user, challenge_token) do
            {:ok,
             %{
               user: user,
               dispatched: true,
               challenge_token: challenge_token,
               payload_json: payload_json
             }}
          end
        end)

      {:error, %Ecto.Changeset{} = changeset} ->
        if email_taken_error?(changeset), do: {:error, :email_taken}, else: {:error, changeset}
    end
  end

  @spec begin_passkey_log_in(String.t()) :: passkey_challenge_result()
  defp begin_passkey_log_in(email) do
    case get_user_by_email(email) do
      %User{} = user ->
        passkeys = list_active_user_passkeys(user)

        if not active_user?(user) or passkeys == [] do
          {:error, :invalid_credentials}
        else
          Repo.transact(fn ->
            with {:ok, %{token: challenge_token}} <-
                   issue_passkey_authentication_challenge_token(user),
                 {:ok, payload_json} <-
                   passkey_authentication_payload(user, passkeys, challenge_token) do
              {:ok,
               %{
                 user: user,
                 dispatched: true,
                 challenge_token: challenge_token,
                 payload_json: payload_json
               }}
            end
          end)
        end

      _other ->
        {:error, :invalid_credentials}
    end
  end

  @spec passkey_registration_payload(User.t(), String.t()) ::
          {:ok, String.t()} | {:error, :passkey_verification_failed}
  defp passkey_registration_payload(%User{} = user, challenge_token)
       when is_binary(challenge_token) do
    with {:ok, %{raw_secret: raw_secret}} <- Tokens.decode_serialized_value(challenge_token),
         {:ok, options} <- Passkeys.build_registration_options(user, raw_secret) do
      {:ok, Passkeys.challenge_options_json(options)}
    else
      _other -> {:error, :passkey_verification_failed}
    end
  end

  @spec passkey_authentication_payload(User.t(), [UserPasskey.t()], String.t()) ::
          {:ok, String.t()} | {:error, :passkey_verification_failed}
  defp passkey_authentication_payload(%User{} = user, passkeys, challenge_token)
       when is_list(passkeys) and is_binary(challenge_token) do
    with {:ok, %{raw_secret: raw_secret}} <- Tokens.decode_serialized_value(challenge_token),
         {:ok, options} <- Passkeys.build_authentication_options(user, passkeys, raw_secret) do
      {:ok, Passkeys.challenge_options_json(options)}
    else
      _other -> {:error, :passkey_verification_failed}
    end
  end

  @spec fetch_passkey_challenge(
          String.t() | nil,
          :passkey_registration_challenge_token | :passkey_authentication_challenge_token
        ) ::
          {:ok, {User.t(), UserToken.t(), binary()}}
          | {:error, :expired_token | :invalid_token | :revoked_token}
  defp fetch_passkey_challenge(serialized_value, expected_context)
       when is_binary(serialized_value) and
              expected_context in [
                :passkey_registration_challenge_token,
                :passkey_authentication_challenge_token
              ] do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {:ok, {user, user_token, current_email}} <- fetch_token_lookup_row(query),
         :ok <-
           validate_passkey_challenge_token(
             user_token,
             raw_secret,
             current_email,
             expected_context
           ) do
      {:ok, {hydrate_user(user, user_token, current_email), user_token, raw_secret}}
    else
      :error -> {:error, :invalid_token}
      {:error, reason} -> {:error, reason}
    end
  end

  defp fetch_passkey_challenge(_serialized_value, _expected_context),
    do: {:error, :invalid_token}

  @spec validate_passkey_challenge_token(
          UserToken.t(),
          binary(),
          String.t() | nil,
          :passkey_registration_challenge_token | :passkey_authentication_challenge_token
        ) :: :ok | {:error, :expired_token | :invalid_token}
  defp validate_passkey_challenge_token(
         %UserToken{context: context},
         _raw_secret,
         _current_email,
         expected_context
       )
       when context != expected_context,
       do: {:error, :invalid_token}

  defp validate_passkey_challenge_token(
         %UserToken{} = user_token,
         raw_secret,
         current_email,
         :passkey_registration_challenge_token
       )
       when is_binary(raw_secret) do
    cond do
      not Tokens.valid_secret?(user_token, raw_secret) ->
        {:error, :invalid_token}

      not Tokens.valid_passkey_registration_challenge_token?(
        user_token,
        raw_secret,
        current_email
      ) ->
        {:error, :expired_token}

      true ->
        :ok
    end
  end

  defp validate_passkey_challenge_token(
         %UserToken{} = user_token,
         raw_secret,
         current_email,
         :passkey_authentication_challenge_token
       )
       when is_binary(raw_secret) do
    cond do
      not Tokens.valid_secret?(user_token, raw_secret) ->
        {:error, :invalid_token}

      not Tokens.valid_passkey_authentication_challenge_token?(
        user_token,
        raw_secret,
        current_email
      ) ->
        {:error, :expired_token}

      true ->
        :ok
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
    sync_contact_entry_identifiers(
      contact_entry_id,
      normalized_emails,
      &find_or_create_email_address_id/1,
      UserContactEntryEmailAddress,
      :email_address_id
    )
  end

  defp sync_contact_entry_phone_numbers(contact_entry_id, normalized_phone_numbers) do
    sync_contact_entry_identifiers(
      contact_entry_id,
      normalized_phone_numbers,
      &find_or_create_phone_number_id/1,
      UserContactEntryPhoneNumber,
      :phone_number_id
    )
  end

  # Generic join reconciler shared by email/phone syncing: resolve desired IDs,
  # prune joins no longer desired, then upsert the remaining join rows.
  defp sync_contact_entry_identifiers(
         contact_entry_id,
         normalized_values,
         find_or_create_identifier_id,
         join_schema,
         identifier_key
       )
       when is_integer(contact_entry_id) and is_list(normalized_values) and
              is_function(find_or_create_identifier_id, 1) and is_atom(identifier_key) do
    desired_ids =
      normalized_values
      |> Enum.map(find_or_create_identifier_id)
      |> Enum.uniq()

    prune_contact_entry_identifiers(contact_entry_id, desired_ids, join_schema, identifier_key)

    Enum.each(desired_ids, fn identifier_id ->
      Repo.insert(
        struct(join_schema, %{
          identifier_key => identifier_id,
          user_contact_entry_id: contact_entry_id
        }),
        on_conflict: :nothing,
        conflict_target: [:user_contact_entry_id, identifier_key]
      )
    end)

    :ok
  end

  defp prune_contact_entry_identifiers(contact_entry_id, [], join_schema, _identifier_key) do
    Repo.delete_all(
      from(join in join_schema,
        where: join.user_contact_entry_id == ^contact_entry_id
      )
    )
  end

  defp prune_contact_entry_identifiers(contact_entry_id, desired_ids, join_schema, identifier_key) do
    Repo.delete_all(
      from(join in join_schema,
        where:
          join.user_contact_entry_id == ^contact_entry_id and
            field(join, ^identifier_key) not in ^desired_ids
      )
    )
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

  defp build_contact_match(owner_id, owner_email_address_ids, contact_entry) do
    %{
      id: contact_entry.id,
      contact_entry: contact_entry,
      invite_recipient: contact_invite_recipient(contact_entry, owner_email_address_ids),
      matched_users: matched_users_for_contact_entry(owner_id, contact_entry)
    }
  end

  defp contact_invite_recipient(contact_entry, owner_email_address_ids) do
    contact_entry.email_addresses
    |> Enum.reject(&MapSet.member?(owner_email_address_ids, &1.id))
    |> Enum.map(& &1.normalized_email)
    |> Enum.sort()
    |> List.first()
  end

  defp owner_email_address_ids(owner_id) do
    from(user_email_address in UserEmailAddress,
      where: user_email_address.user_id == ^owner_id,
      select: user_email_address.email_address_id
    )
    |> Repo.all()
    |> MapSet.new()
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
    candidate_user_ids =
      from(user_email_address in UserEmailAddress,
        where:
          user_email_address.user_id != ^owner_id and
            user_email_address.email_address_id in ^email_address_ids,
        select: user_email_address.user_id,
        distinct: true
      )

    # Confirmation used to update only users.confirmed_at. Treat that legacy state as
    # verification only for the earliest (primary) email join, never for later aliases.
    primary_email_join_ids =
      from(user_email_address in UserEmailAddress,
        where: user_email_address.user_id in subquery(candidate_user_ids),
        group_by: user_email_address.user_id,
        select: %{user_id: user_email_address.user_id, id: min(user_email_address.id)}
      )

    from(user in User,
      join: user_email_address in UserEmailAddress,
      on: user_email_address.user_id == user.id,
      join: primary_email_join in subquery(primary_email_join_ids),
      on: primary_email_join.user_id == user.id,
      where:
        user.id != ^owner_id and user_email_address.email_address_id in ^email_address_ids and
          (not is_nil(user_email_address.verified_at) or
             (not is_nil(user.confirmed_at) and user_email_address.id == primary_email_join.id)),
      distinct: user.id
    )
    |> Repo.all()
  end

  defp matched_users_by_phone(_owner_id, []), do: []

  defp matched_users_by_phone(owner_id, phone_number_ids) do
    from(user in User,
      join: user_phone_number in UserPhoneNumber,
      on: user_phone_number.user_id == user.id,
      where:
        user.id != ^owner_id and user_phone_number.phone_number_id in ^phone_number_ids and
          not is_nil(user_phone_number.verified_at),
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

  defp user_identity_by_id_query(user_id, identity_id) do
    from(user_identity in UserIdentity,
      where: user_identity.user_id == ^user_id and user_identity.id == ^identity_id,
      limit: 1
    )
  end

  defp active_user_identity_by_id_query(user_id, identity_id) do
    from(user_identity in UserIdentity,
      where:
        user_identity.user_id == ^user_id and
          user_identity.id == ^identity_id and
          is_nil(user_identity.revoked_at),
      limit: 1
    )
  end

  defp active_provider_identity_query(provider, provider_uid) do
    from(user_identity in UserIdentity,
      where:
        user_identity.provider == ^provider and
          user_identity.provider_uid == ^provider_uid and
          is_nil(user_identity.revoked_at),
      limit: 1
    )
  end

  @spec active_staff_permission(pos_integer(), staff_permission()) :: StaffPermission.t() | nil
  defp active_staff_permission(user_id, permission)
       when is_integer(user_id) and user_id > 0 do
    user_id
    |> active_staff_permissions_query()
    |> where([staff_permission], staff_permission.permission == ^permission)
    |> limit(1)
    |> Repo.one()
  end

  @spec handle_staff_permission_grant_insert(
          staff_permission_result(),
          pos_integer(),
          staff_permission()
        ) :: staff_permission_result()
  defp handle_staff_permission_grant_insert(
         {:ok, %StaffPermission{} = staff_permission},
         _user_id,
         _permission
       ),
       do: {:ok, staff_permission}

  defp handle_staff_permission_grant_insert(
         {:error, %Ecto.Changeset{} = changeset},
         user_id,
         permission
       ) do
    if active_staff_permission_conflict?(changeset) do
      case active_staff_permission(user_id, permission) do
        %StaffPermission{} = staff_permission -> {:ok, staff_permission}
        nil -> {:error, changeset}
      end
    else
      {:error, changeset}
    end
  end

  @spec active_staff_permission_conflict?(Ecto.Changeset.t()) :: boolean()
  defp active_staff_permission_conflict?(%Ecto.Changeset{errors: errors}) do
    Enum.any?(errors, fn
      {:user_id,
       {_message,
        constraint: :unique, constraint_name: "staff_permissions_active_user_permission_index"}} ->
        true

      _error ->
        false
    end)
  end

  @spec active_staff_permissions_query(pos_integer()) :: Ecto.Query.t()
  defp active_staff_permissions_query(user_id)
       when is_integer(user_id) and user_id > 0 do
    from(staff_permission in StaffPermission,
      where: staff_permission.user_id == ^user_id and is_nil(staff_permission.revoked_at),
      order_by: [asc: staff_permission.granted_at, asc: staff_permission.id]
    )
  end

  defp active_user_passkey_query(user_id, credential_id) do
    from(user_passkey in UserPasskey,
      join: user_identity in UserIdentity,
      on: user_identity.id == user_passkey.user_identity_id,
      where:
        user_passkey.user_id == ^user_id and
          user_passkey.credential_id == ^credential_id and
          is_nil(user_identity.revoked_at),
      limit: 1
    )
  end

  defp active_user_passkeys_query(user_id) do
    from(user_passkey in UserPasskey,
      join: user_identity in UserIdentity,
      on: user_identity.id == user_passkey.user_identity_id,
      where: user_passkey.user_id == ^user_id and is_nil(user_identity.revoked_at),
      order_by: [asc: user_passkey.inserted_at, asc: user_passkey.id]
    )
  end

  defp provider_identity_exists?(provider, provider_uid) do
    from(user_identity in UserIdentity,
      where: user_identity.provider == ^provider and user_identity.provider_uid == ^provider_uid,
      select: 1,
      limit: 1
    )
    |> Repo.exists?()
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

  @spec fresh_user!(User.t()) :: User.t()
  defp fresh_user!(%User{id: user_id}) when is_integer(user_id), do: Repo.get!(User, user_id)

  @spec active_user?(User.t() | nil) :: boolean()
  defp active_user?(%User{suspended_at: nil}), do: true
  defp active_user?(%User{}), do: false
  defp active_user?(_), do: false

  @spec fetch_token_lookup_row(Ecto.Query.t()) ::
          {:ok, {User.t(), UserToken.t(), String.t() | nil}} | {:error, :revoked_token}
  defp fetch_token_lookup_row(query) do
    case Repo.one(query) do
      {user, user_token, current_email} -> {:ok, {user, user_token, current_email}}
      nil -> {:error, :revoked_token}
    end
  end

  @spec authenticate_user_token(
          String.t(),
          (UserToken.t(), binary() -> :ok | {:error, access_token_auth_error()})
        ) :: token_auth_result()
  defp authenticate_user_token(serialized_value, validate_fun)
       when is_binary(serialized_value) and is_function(validate_fun, 2) do
    with {:ok, query, raw_secret} <- Tokens.user_token_lookup_query(serialized_value),
         {:ok, {user, user_token, current_email}} <- fetch_token_lookup_row(query),
         :ok <- validate_fun.(user_token, raw_secret),
         true <- active_user?(user) || {:error, :revoked_token} do
      {:ok, scope_for_user(hydrate_user(user, user_token, current_email))}
    else
      :error ->
        {:error, :invalid_token}

      {:error, reason} when reason in [:invalid_token, :expired_token, :revoked_token] ->
        {:error, reason}
    end
  end

  @spec validate_access_token(UserToken.t(), binary()) ::
          :ok | {:error, :invalid_token | :expired_token}
  defp validate_access_token(%UserToken{} = user_token, raw_secret) do
    validate_token(user_token, raw_secret, :access_token, &Tokens.valid_session_token?/2)
  end

  @spec validate_refresh_token(UserToken.t(), binary()) ::
          :ok | {:error, :invalid_token | :expired_token}
  defp validate_refresh_token(%UserToken{} = user_token, raw_secret) do
    validate_token(user_token, raw_secret, :refresh_token, &Tokens.valid_refresh_token?/2)
  end

  @spec validate_token(
          UserToken.t(),
          binary(),
          LCSchemas.Accounts.user_token_context(),
          (UserToken.t(), binary() -> boolean())
        ) :: :ok | {:error, :invalid_token | :expired_token}
  defp validate_token(%UserToken{context: context}, _raw_secret, expected_context, _valid_fun)
       when context != expected_context,
       do: {:error, :invalid_token}

  defp validate_token(%UserToken{} = user_token, raw_secret, _expected_context, valid_fun)
       when is_binary(raw_secret) and is_function(valid_fun, 2) do
    cond do
      not Tokens.valid_secret?(user_token, raw_secret) ->
        {:error, :invalid_token}

      not valid_fun.(user_token, raw_secret) ->
        {:error, :expired_token}

      true ->
        :ok
    end
  end

  @spec refresh_token_secret_matches?(UserToken.t(), binary()) :: boolean()
  defp refresh_token_secret_matches?(%UserToken{context: :refresh_token} = user_token, raw_secret)
       when is_binary(raw_secret) do
    Tokens.valid_secret?(user_token, raw_secret)
  end

  defp refresh_token_secret_matches?(_user_token, _raw_secret), do: false

  @spec list_active_user_passkeys(User.t()) :: [UserPasskey.t()]
  defp list_active_user_passkeys(%User{id: user_id}) when is_integer(user_id) do
    user_id
    |> active_user_passkeys_query()
    |> Repo.all()
  end

  @spec active_user_passkey(pos_integer(), String.t()) :: UserPasskey.t() | nil
  defp active_user_passkey(user_id, credential_id)
       when is_integer(user_id) and is_binary(credential_id) do
    user_id
    |> active_user_passkey_query(credential_id)
    |> Repo.one()
  end

  @spec ensure_passkey_credential_available(String.t()) ::
          :ok | {:error, :provider_identity_exists}
  defp ensure_passkey_credential_available(credential_id) when is_binary(credential_id) do
    if provider_identity_exists?(:passkey_provider, credential_id) do
      {:error, :provider_identity_exists}
    else
      :ok
    end
  end

  @spec persist_passkey_identity(User.t(), Passkeys.verification_result()) ::
          {:ok, UserIdentity.t()} | {:error, changeset()}
  defp persist_passkey_identity(%User{} = user, verified_passkey) when is_map(verified_passkey) do
    register_user_identity(
      user,
      :passkey_provider,
      verified_passkey.credential_id,
      provider_data: %{"credential_id" => verified_passkey.credential_id},
      last_used_at: now_utc()
    )
  end

  @spec persist_user_passkey(User.t(), UserIdentity.t(), Passkeys.verification_result()) ::
          {:ok, UserPasskey.t()} | {:error, changeset()}
  defp persist_user_passkey(%User{} = user, %UserIdentity{} = identity, verified_passkey)
       when is_map(verified_passkey) do
    Repo.insert(%UserPasskey{
      user_id: user.id,
      user_identity_id: identity.id,
      credential_id: verified_passkey.credential_id,
      public_key: verified_passkey.public_key,
      sign_count: verified_passkey.sign_count,
      transports: verified_passkey.transports,
      last_used_at: now_utc()
    })
  end

  @spec touch_user_passkey(UserPasskey.t(), non_neg_integer()) ::
          {:ok, UserPasskey.t()} | {:error, changeset()}
  defp touch_user_passkey(%UserPasskey{} = user_passkey, sign_count)
       when is_integer(sign_count) and sign_count >= 0 do
    # Keep the verifier-provided counter so later assertions can reject stale
    # authenticators instead of silently allowing sign_count rollback.
    user_passkey
    |> change(sign_count: sign_count, last_used_at: now_utc())
    |> Repo.update()
  end

  @spec confirm_user(User.t()) :: user_result()
  defp confirm_user(%User{} = user) do
    fresh_user = fresh_user!(user)

    if fresh_user.confirmed_at do
      {:ok, put_primary_email(fresh_user)}
    else
      fresh_user
      |> change(confirmed_at: now_utc())
      |> Repo.update()
      |> case do
        {:ok, confirmed_user} -> {:ok, put_primary_email(confirmed_user)}
        {:error, changeset} -> {:error, changeset}
      end
    end
  end

  @spec revoke_user_token(UserToken.t(), keyword()) :: :ok | {:error, :revoked_token}
  defp revoke_user_token(%UserToken{id: token_id}, opts) do
    {deleted_count, _rows} =
      Repo.delete_all(from(token in UserToken, where: token.id == ^token_id))

    if deleted_count == 0 and Keyword.get(opts, :strict, false) do
      {:error, :revoked_token}
    else
      :ok
    end
  end

  @spec emit_auth_event(auth_event_type(), auth_event_opts()) :: :ok
  defp emit_auth_event(event_type, opts) do
    attrs = AuthEvent.attrs_for_insert(event_type, opts)

    # Audit logging is best-effort only; auth control flow must remain deterministic
    # even if event persistence or telemetry emission encounters an error.
    audit_persisted =
      case persist_auth_event(attrs) do
        {:ok, _auth_event} -> :ok
        {:error, _changeset} -> :error
      end

    :ok = emit_auth_telemetry(event_type, attrs, audit_persisted)
    :ok
  end

  @spec emit_auth_telemetry(auth_event_type(), AuthEvent.attrs(), :ok | :error) :: :ok
  defp emit_auth_telemetry(event_type, attrs, audit_persisted)
       when is_atom(event_type) and is_map(attrs) and audit_persisted in [:ok, :error] do
    # Keep metadata bounded to already-sanitized auth event attrs so runtime
    # observability matches persisted audit semantics without leaking secrets.
    :telemetry.execute(
      [:live_canvas, :accounts, :auth, event_type],
      %{count: 1},
      %{
        user_id: Map.get(attrs, :user_id),
        metadata: Map.get(attrs, :metadata, %{}),
        audit_persisted: audit_persisted
      }
    )

    :ok
  end

  @spec emit_refresh_token_rotation_event(token_pair_result()) :: :ok
  defp emit_refresh_token_rotation_event(
         {:ok, %{refresh_token: %{user_token: %UserToken{user_id: user_id}}}}
       )
       when is_integer(user_id) do
    emit_auth_event(:refresh_token_rotation_succeeded,
      user_id: user_id,
      metadata: %{"method" => "refresh_token", "outcome" => "rotated"}
    )
  end

  defp emit_refresh_token_rotation_event({:error, reason})
       when reason in [:invalid_token, :expired_token, :revoked_token] do
    emit_auth_event(:refresh_token_rotation_failed,
      metadata: %{"method" => "refresh_token", "reason" => Atom.to_string(reason)}
    )
  end

  defp emit_refresh_token_rotation_event(_result), do: :ok

  @spec emit_password_reset_auth_event(password_reset_result()) :: :ok
  defp emit_password_reset_auth_event({:ok, {%User{} = user, _expired_tokens}}) do
    emit_auth_event(:account_recovery_succeeded,
      user: user,
      metadata: %{"method" => "password_reset_token"}
    )
  end

  defp emit_password_reset_auth_event({:error, :not_found}) do
    emit_auth_event(:account_recovery_failed,
      metadata: %{"method" => "password_reset_token", "reason" => "not_found"}
    )
  end

  defp emit_password_reset_auth_event({:error, %Ecto.Changeset{} = changeset}) do
    emit_auth_event(:account_recovery_failed,
      user_id: changeset_user_id(changeset),
      metadata: %{"method" => "password_reset_token", "reason" => "validation_failed"}
    )
  end

  defp emit_password_reset_auth_event(_result), do: :ok

  @spec emit_unlink_identity_auth_event(unlink_user_identity_result(), User.t()) :: :ok
  defp emit_unlink_identity_auth_event(
         {:ok, %UserIdentity{provider: provider}},
         %User{} = user
       )
       when is_atom(provider) do
    emit_auth_event(:provider_identity_unlink_succeeded,
      user: user,
      metadata: %{"provider" => provider_label(provider)}
    )
  end

  defp emit_unlink_identity_auth_event({:error, reason}, %User{} = user)
       when reason in [:not_found, :already_revoked, :last_sign_in_method] do
    emit_auth_event(:provider_identity_unlink_failed,
      user: user,
      metadata: %{"reason" => Atom.to_string(reason)}
    )
  end

  defp emit_unlink_identity_auth_event(_result, _user), do: :ok

  @spec provider_label(LCSchemas.Accounts.user_identity_provider()) :: String.t()
  defp provider_label(provider) when is_atom(provider), do: Atom.to_string(provider)

  @spec changeset_user_id(Ecto.Changeset.t()) :: pos_integer() | nil
  defp changeset_user_id(%Ecto.Changeset{data: %User{id: user_id}})
       when is_integer(user_id) and user_id > 0,
       do: user_id

  defp changeset_user_id(_changeset), do: nil

  @spec revoke_identity_if_active(UserIdentity.t()) ::
          {:ok, UserIdentity.t()} | {:error, changeset()}
  defp revoke_identity_if_active(%UserIdentity{} = user_identity) do
    user_identity
    |> change(revoked_at: now_utc())
    |> Repo.update()
  end

  @spec active_identity(UserIdentity.t() | nil) ::
          UserIdentity.t() | {:error, :not_found | :already_revoked}
  defp active_identity(nil), do: {:error, :not_found}
  defp active_identity(%UserIdentity{revoked_at: %DateTime{}}), do: {:error, :already_revoked}
  defp active_identity(%UserIdentity{} = user_identity), do: user_identity

  @spec identity_unlinkable?(User.t(), UserIdentity.t()) :: boolean()
  defp identity_unlinkable?(%User{hashed_password: hashed_password}, %UserIdentity{
         id: identity_id,
         user_id: user_id
       }) do
    # A password can replace the provider being removed; passwordless accounts
    # must retain another identity supported by an actual authentication entry point.
    password_sign_in_available?(hashed_password) or
      active_alternate_sign_in_identity?(user_id, identity_id)
  end

  @spec password_sign_in_available?(term()) :: boolean()
  defp password_sign_in_available?(hashed_password) when is_binary(hashed_password),
    do: String.trim(hashed_password) != ""

  defp password_sign_in_available?(_hashed_password), do: false

  @spec active_alternate_sign_in_identity?(pos_integer(), pos_integer()) :: boolean()
  defp active_alternate_sign_in_identity?(user_id, excluded_identity_id) do
    from(user_identity in UserIdentity,
      where:
        user_identity.user_id == ^user_id and
          user_identity.id != ^excluded_identity_id and
          user_identity.provider in ^@sign_in_identity_providers and
          is_nil(user_identity.revoked_at)
    )
    |> Repo.exists?()
  end

  @spec normalize_query_limit(term()) :: pos_integer()
  defp normalize_query_limit(limit) when is_integer(limit) and limit > 0, do: limit
  defp normalize_query_limit(_limit), do: 50

  @spec persist_auth_event(AuthEvent.attrs()) :: auth_event_result()
  defp persist_auth_event(attrs) when is_map(attrs) do
    %AuthEventSchema{}
    |> AuthEvent.changeset(attrs)
    |> Repo.insert()
  end

  @spec now_utc() :: DateTime.t()
  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)

  defp email_taken?(nil), do: false
  defp email_taken?(email), do: not is_nil(get_user_by_email(email))

  @spec magic_link_login_allowed?(User.t()) :: boolean()
  defp magic_link_login_allowed?(%User{confirmed_at: nil, hashed_password: hashed_password})
       when not is_nil(hashed_password),
       do: false

  defp magic_link_login_allowed?(%User{}), do: true

  @spec email_taken_error?(Ecto.Changeset.t()) :: boolean()
  defp email_taken_error?(%Ecto.Changeset{} = changeset) do
    Enum.any?(Keyword.get_values(changeset.errors, :email), fn {message, _opts} ->
      message == "has already been taken"
    end)
  end

  defp email_taken_changeset(changeset),
    do: add_error(changeset, :email, "has already been taken")
end
