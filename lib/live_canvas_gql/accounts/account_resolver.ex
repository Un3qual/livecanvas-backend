defmodule LCGQL.Accounts.Resolver do
  alias LC.Accounts
  alias LCGQL.FieldNames
  alias LCGQL.MutationErrors

  @type mutation_error :: MutationErrors.user_error()
  @type auth_error_code :: MutationErrors.auth_error_code()
  @type auth_error :: MutationErrors.auth_error()
  @type password_reset_request_payload :: %{errors: [mutation_error()]}
  @type password_reset_request_result :: {:ok, password_reset_request_payload()}
  @type password_reset_payload :: %{reset: boolean(), errors: [mutation_error()]}
  @type password_reset_mutation_result :: {:ok, password_reset_payload()}
  @type auth_challenge_payload :: %{challenge: map() | nil, errors: [auth_error()]}
  @type auth_challenge_result :: {:ok, auth_challenge_payload()}
  @type auth_token_payload :: %{
          access_token: map() | nil,
          refresh_token: map() | nil,
          errors: [mutation_error()]
        }
  @type auth_token_result :: {:ok, auth_token_payload()}
  @type auth_entry_payload :: %{
          access_token: map() | nil,
          refresh_token: map() | nil,
          errors: [auth_error()]
        }
  @type auth_entry_result :: {:ok, auth_entry_payload()}
  @type revoke_refresh_payload :: %{revoked: boolean(), errors: [mutation_error()]}
  @type revoke_refresh_result :: {:ok, revoke_refresh_payload()}
  @type reset_password_error_reason :: :invalid_or_expired
  @type refresh_auth_error_reason :: :invalid_token | :expired_token | :revoked_token
  @type token_view :: %{
          serialized_value: String.t(),
          token_version: integer(),
          expires_at: String.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: String.t() | nil
        }

  @spec request_password_reset(
          term(),
          %{optional(:input) => map(), optional(:email) => String.t()},
          Absinthe.Resolution.t()
        ) :: password_reset_request_result()
  def request_password_reset(parent, %{input: input}, resolution),
    do: request_password_reset(parent, input, resolution)

  def request_password_reset(_parent, %{email: email}, _resolution) do
    case Accounts.get_user_by_email(email) do
      nil ->
        {:ok, %{errors: []}}

      user ->
        # Keep recovery delivery response uniform to avoid account enumeration
        # while still exercising the same notifier pipeline for real users.
        case Accounts.deliver_user_reset_password_instructions(
               user,
               &password_reset_url/1
             ) do
          {:ok, _email} -> :ok
          _ -> :ok
        end

        {:ok, %{errors: []}}
    end
  end

  @spec reset_password(
          term(),
          %{
            optional(:input) => map(),
            optional(:token) => String.t(),
            optional(:password) => String.t(),
            optional(:password_confirmation) => String.t()
          },
          Absinthe.Resolution.t()
        ) :: password_reset_mutation_result()
  def reset_password(parent, %{input: input}, resolution),
    do: reset_password(parent, input, resolution)

  def reset_password(_parent, args, _resolution) do
    attrs = %{
      password: Map.get(args, :password),
      password_confirmation: Map.get(args, :password_confirmation)
    }

    case Accounts.reset_user_password(Map.get(args, :token), attrs) do
      {:ok, {_user, _expired_tokens}} ->
        {:ok, %{reset: true, errors: []}}

      {:error, :not_found} ->
        {:ok, %{reset: false, errors: [reset_password_error(:invalid_or_expired)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{reset: false, errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)}}
    end
  end

  @spec begin_auth_challenge(
          term(),
          map(),
          Absinthe.Resolution.t()
        ) :: auth_challenge_result()
  def begin_auth_challenge(parent, %{input: input}, resolution),
    do: begin_auth_challenge(parent, input, resolution)

  def begin_auth_challenge(_parent, %{provider: :password}, _resolution) do
    {:ok,
     %{challenge: nil, errors: [MutationErrors.auth_error("provider", :unsupported_provider)]}}
  end

  def begin_auth_challenge(
        _parent,
        %{provider: :magic_link, purpose: purpose, magic_link: magic_link_input},
        _resolution
      )
      when purpose in [:sign_up, :log_in] and is_map(magic_link_input) do
    with :ok <- require_auth_field(magic_link_input, :email, "magicLink") do
      case Accounts.begin_magic_link_challenge(
             purpose,
             Map.fetch!(magic_link_input, :email),
             &magic_link_url/1
           ) do
        {:ok, %{dispatched: dispatched}} ->
          {:ok,
           %{
             challenge: %{
               provider: :magic_link,
               purpose: purpose,
               dispatched: dispatched,
               challenge_token: nil,
               payload_json: nil
             },
             errors: []
           }}

        {:error, :email_taken} ->
          {:ok,
           %{
             challenge: nil,
             errors: [
               MutationErrors.auth_error(
                 "magicLink.email",
                 :email_taken,
                 "has already been taken"
               )
             ]
           }}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           %{
             challenge: nil,
             errors:
               MutationErrors.auth_changeset_errors(
                 changeset,
                 "magicLink",
                 &FieldNames.lower_camel/1
               )
           }}
      end
    else
      {:error, auth_error} ->
        {:ok, %{challenge: nil, errors: [auth_error]}}
    end
  end

  def begin_auth_challenge(
        _parent,
        %{provider: :passkey, purpose: purpose, passkey: passkey_input},
        _resolution
      )
      when purpose in [:sign_up, :log_in] and is_map(passkey_input) do
    with :ok <- require_auth_field(passkey_input, :email, "passkey") do
      case Accounts.begin_passkey_challenge(
             purpose,
             Map.fetch!(passkey_input, :email)
           ) do
        {:ok, %{challenge_token: challenge_token, payload_json: payload_json} = challenge} ->
          dispatched = Map.get(challenge, :dispatched, true)

          {:ok,
           %{
             challenge: %{
               provider: :passkey,
               purpose: purpose,
               dispatched: dispatched,
               challenge_token: challenge_token,
               payload_json: payload_json
             },
             errors: []
           }}

        {:error, :email_taken} ->
          {:ok,
           %{
             challenge: nil,
             errors: [
               MutationErrors.auth_error("passkey.email", :email_taken, "has already been taken")
             ]
           }}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           %{
             challenge: nil,
             errors:
               MutationErrors.auth_changeset_errors(
                 changeset,
                 "passkey",
                 &FieldNames.lower_camel/1
               )
           }}

        {:error, reason} ->
          {:ok, %{challenge: nil, errors: [passkey_challenge_error(reason)]}}
      end
    else
      {:error, auth_error} ->
        {:ok, %{challenge: nil, errors: [auth_error]}}
    end
  end

  def begin_auth_challenge(_parent, %{provider: provider, purpose: purpose}, _resolution)
      when provider in [:magic_link, :passkey] and purpose in [:sign_up, :log_in] do
    {:ok,
     %{
       challenge: %{
         provider: provider,
         purpose: purpose,
         dispatched: false,
         challenge_token: nil,
         payload_json: nil
       },
       errors: [MutationErrors.auth_error(nil, :invalid_input)]
     }}
  end

  def begin_auth_challenge(_parent, _args, _resolution) do
    {:ok, %{challenge: nil, errors: [MutationErrors.auth_error(nil, :invalid_input)]}}
  end

  @spec sign_up(
          term(),
          %{optional(:input) => map(), optional(:provider) => atom()},
          Absinthe.Resolution.t()
        ) :: auth_entry_result()
  def sign_up(parent, %{input: input}, resolution), do: sign_up(parent, input, resolution)

  def sign_up(_parent, %{provider: :password, password: password_input}, _resolution)
      when is_map(password_input) do
    with :ok <- require_auth_field(password_input, :email, "password"),
         :ok <- require_auth_field(password_input, :password, "password"),
         :ok <- require_auth_field(password_input, :password_confirmation, "password") do
      case Accounts.sign_up_with_password(password_input) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :email_taken} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("password.email", :email_taken, "has already been taken")
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(
               changeset,
               "password",
               &FieldNames.lower_camel/1
             )
           )}

        {:error, :invalid_credentials} ->
          {:ok, auth_entry_error_payload([MutationErrors.auth_error(nil, :invalid_input)])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def sign_up(_parent, %{provider: :magic_link, magic_link: magic_link_input}, _resolution)
      when is_map(magic_link_input) do
    with :ok <- require_auth_field(magic_link_input, :token, "magicLink") do
      case Accounts.sign_up_with_magic_link(Map.fetch!(magic_link_input, :token)) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("magicLink.token", :invalid_credentials)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(
               changeset,
               "magicLink",
               &FieldNames.lower_camel/1
             )
           )}

        {:error, :email_taken} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error(
               "magicLink.email",
               :email_taken,
               "has already been taken"
             )
           ])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def sign_up(_parent, %{provider: provider, oauth: oauth_input}, _resolution)
      when provider in [:google, :apple] and is_map(oauth_input) do
    with :ok <- require_auth_field(oauth_input, :id_token, "oauth") do
      case Accounts.sign_up_with_provider(provider, Map.fetch!(oauth_input, :id_token)) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :email_taken} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("oauth.idToken", :email_taken, "has already been taken")
           ])}

        {:error, :provider_verification_failed} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("oauth.idToken", :provider_verification_failed)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(changeset, "oauth", &FieldNames.lower_camel/1)
           )}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("oauth.idToken", :provider_verification_failed)
           ])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def sign_up(_parent, %{provider: :passkey, passkey: passkey_input}, _resolution)
      when is_map(passkey_input) do
    with :ok <- require_auth_field(passkey_input, :challenge_token, "passkey"),
         :ok <- require_auth_field(passkey_input, :credential_id, "passkey"),
         :ok <- require_auth_field(passkey_input, :client_data_json, "passkey"),
         :ok <- require_auth_field(passkey_input, :attestation_object, "passkey") do
      # Keep passkey signup in Accounts and return normal auth_entry payloads
      # to keep GraphQL behavior parity with password and magic-link flows.
      case Accounts.sign_up_with_passkey(passkey_input) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.challengeToken", :invalid_credentials)
           ])}

        {:error, :email_taken} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.email", :email_taken, "has already been taken")
           ])}

        {:error, :token_expired} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.challengeToken", :token_expired)
           ])}

        {:error, :token_revoked} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.challengeToken", :token_revoked)
           ])}

        {:error, :passkey_verification_failed} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error(
               "passkey",
               :passkey_verification_failed,
               "passkey_verification_failed"
             )
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(
               changeset,
               "passkey",
               &FieldNames.lower_camel/1
             )
           )}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def sign_up(_parent, _args, _resolution) do
    {:ok, auth_entry_error_payload([MutationErrors.auth_error(nil, :invalid_input)])}
  end

  @spec log_in(
          term(),
          %{optional(:input) => map(), optional(:provider) => atom()},
          Absinthe.Resolution.t()
        ) :: auth_entry_result()
  def log_in(parent, %{input: input}, resolution), do: log_in(parent, input, resolution)

  def log_in(_parent, %{provider: :password, password: password_input}, _resolution)
      when is_map(password_input) do
    with :ok <- require_auth_field(password_input, :email, "password"),
         :ok <- require_auth_field(password_input, :password, "password") do
      case Accounts.log_in_with_password(password_input) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("password.password", :invalid_credentials)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(
               changeset,
               "password",
               &FieldNames.lower_camel/1
             )
           )}

        {:error, :email_taken} ->
          {:ok, auth_entry_error_payload([MutationErrors.auth_error(nil, :invalid_input)])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def log_in(_parent, %{provider: :magic_link, magic_link: magic_link_input}, _resolution)
      when is_map(magic_link_input) do
    with :ok <- require_auth_field(magic_link_input, :token, "magicLink") do
      case Accounts.log_in_with_magic_link(Map.fetch!(magic_link_input, :token)) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("magicLink.token", :invalid_credentials)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(
               changeset,
               "magicLink",
               &FieldNames.lower_camel/1
             )
           )}

        {:error, :email_taken} ->
          {:ok, auth_entry_error_payload([MutationErrors.auth_error(nil, :invalid_input)])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def log_in(_parent, %{provider: provider, oauth: oauth_input}, _resolution)
      when provider in [:google, :apple] and is_map(oauth_input) do
    with :ok <- require_auth_field(oauth_input, :id_token, "oauth") do
      case Accounts.log_in_with_provider(provider, Map.fetch!(oauth_input, :id_token)) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :provider_verification_failed} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("oauth.idToken", :provider_verification_failed)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(changeset, "oauth", &FieldNames.lower_camel/1)
           )}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("oauth.idToken", :provider_verification_failed)
           ])}

        {:error, :email_taken} ->
          {:ok,
           auth_entry_error_payload([MutationErrors.auth_error("oauth.idToken", :invalid_input)])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def log_in(_parent, %{provider: :passkey, passkey: passkey_input}, _resolution)
      when is_map(passkey_input) do
    with :ok <- require_auth_field(passkey_input, :challenge_token, "passkey"),
         :ok <- require_auth_field(passkey_input, :credential_id, "passkey"),
         :ok <- require_auth_field(passkey_input, :client_data_json, "passkey"),
         :ok <- require_auth_field(passkey_input, :authenticator_data, "passkey"),
         :ok <- require_auth_field(passkey_input, :signature, "passkey") do
      # Keep passkey assertions in the Accounts layer and normalize passkey
      # verification errors to the shared auth error contract.
      case Accounts.log_in_with_passkey(passkey_input) do
        {:ok, auth_entry} ->
          {:ok, auth_entry_payload(auth_entry)}

        {:error, :invalid_credentials} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.challengeToken", :invalid_credentials)
           ])}

        {:error, :token_expired} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.challengeToken", :token_expired)
           ])}

        {:error, :token_revoked} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error("passkey.challengeToken", :token_revoked)
           ])}

        {:error, :passkey_verification_failed} ->
          {:ok,
           auth_entry_error_payload([
             MutationErrors.auth_error(
               "passkey",
               :passkey_verification_failed,
               "passkey_verification_failed"
             )
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok,
           auth_entry_error_payload(
             MutationErrors.auth_changeset_errors(
               changeset,
               "passkey",
               &FieldNames.lower_camel/1
             )
           )}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def log_in(_parent, _args, _resolution) do
    {:ok, auth_entry_error_payload([MutationErrors.auth_error(nil, :invalid_input)])}
  end

  @spec issue_viewer_auth_tokens(term(), %{optional(:input) => map()}, Absinthe.Resolution.t()) ::
          auth_token_result()
  def issue_viewer_auth_tokens(parent, %{input: input}, resolution),
    do: issue_viewer_auth_tokens(parent, input, resolution)

  def issue_viewer_auth_tokens(_parent, _args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, access_token_payload} <- Accounts.issue_access_token(user),
         {:ok, refresh_token_payload} <- Accounts.issue_refresh_token(user) do
      {:ok,
       %{
         access_token: token_view(access_token_payload),
         refresh_token: token_view(refresh_token_payload),
         errors: []
       }}
    else
      {:error, _changeset} ->
        {:ok,
         %{
           access_token: nil,
           refresh_token: nil,
           errors: [MutationErrors.user_error(nil, "invalid_token")]
         }}
    end
  end

  def issue_viewer_auth_tokens(_parent, _args, _resolution) do
    {:ok,
     %{
       access_token: nil,
       refresh_token: nil,
       errors: [MutationErrors.user_error(nil, :unauthenticated)]
     }}
  end

  @spec refresh_auth_tokens(
          term(),
          %{optional(:input) => map(), optional(:refresh_token) => String.t()},
          Absinthe.Resolution.t()
        ) :: auth_token_result()
  def refresh_auth_tokens(parent, %{input: input}, resolution),
    do: refresh_auth_tokens(parent, input, resolution)

  def refresh_auth_tokens(_parent, %{refresh_token: refresh_token}, _resolution) do
    # The refresh lifecycle is owned by Accounts; the GraphQL adapter just maps
    # the stable domain error contract into client-facing payload errors.
    case Accounts.rotate_refresh_token(refresh_token) do
      {:ok, %{access_token: access_token_payload, refresh_token: refresh_token_payload}} ->
        {:ok,
         %{
           access_token: token_view(access_token_payload),
           refresh_token: token_view(refresh_token_payload),
           errors: []
         }}

      {:error, reason} when reason in [:invalid_token, :expired_token, :revoked_token] ->
        {:ok,
         %{
           access_token: nil,
           refresh_token: nil,
           errors: [refresh_auth_error(reason)]
         }}
    end
  end

  @spec revoke_refresh_token(
          term(),
          %{optional(:input) => map(), optional(:refresh_token) => String.t()},
          Absinthe.Resolution.t()
        ) :: revoke_refresh_result()
  def revoke_refresh_token(parent, %{input: input}, resolution),
    do: revoke_refresh_token(parent, input, resolution)

  def revoke_refresh_token(_parent, %{refresh_token: refresh_token}, _resolution) do
    :ok = Accounts.revoke_refresh_token(refresh_token)
    {:ok, %{revoked: true, errors: []}}
  end

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec magic_link_url(String.t()) :: String.t()
  defp magic_link_url(token), do: "https://livecanvas.invalid/users/log-in/#{token}"

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec password_reset_url(String.t()) :: String.t()
  defp password_reset_url(token), do: "https://livecanvas.invalid/users/reset-password/#{token}"

  @spec blank?(term()) :: boolean()
  defp blank?(value), do: value in [nil, ""]

  @spec reset_password_error(reset_password_error_reason()) :: mutation_error()
  defp reset_password_error(:invalid_or_expired),
    do: MutationErrors.user_error(nil, :invalid_or_expired)

  @spec refresh_auth_error(refresh_auth_error_reason()) :: mutation_error()
  defp refresh_auth_error(reason),
    do: MutationErrors.user_error("refreshToken", reason)

  @spec auth_entry_payload(LC.Accounts.auth_entry_payload()) :: auth_entry_payload()
  defp auth_entry_payload(%{access_token: access_token, refresh_token: refresh_token}) do
    %{
      access_token: token_view(access_token),
      refresh_token: token_view(refresh_token),
      errors: []
    }
  end

  @spec passkey_challenge_error(:invalid_credentials | :passkey_verification_failed) ::
          auth_error()
  defp passkey_challenge_error(:invalid_credentials),
    do: MutationErrors.auth_error("passkey.challengeToken", :invalid_credentials)

  defp passkey_challenge_error(:passkey_verification_failed),
    do: MutationErrors.auth_error("passkey", :passkey_verification_failed)

  @spec auth_entry_error_payload([auth_error()]) :: auth_entry_payload()
  defp auth_entry_error_payload(errors) do
    %{access_token: nil, refresh_token: nil, errors: errors}
  end

  defp require_auth_field(input, field, prefix) when is_map(input) and is_atom(field) do
    if blank?(Map.get(input, field)) do
      {:error,
       MutationErrors.auth_error(
         prefixed_auth_field(prefix, field),
         :invalid_input,
         "is required"
       )}
    else
      :ok
    end
  end

  @spec token_view(LC.Accounts.token_payload()) :: token_view()
  defp token_view(%{token: serialized_value, user_token: user_token}) do
    %{
      serialized_value: serialized_value,
      token_version: 1,
      expires_at: nil,
      inserted_at: user_token.inserted_at,
      updated_at: nil
    }
  end

  defp prefixed_auth_field(prefix, field) when is_binary(prefix) and is_atom(field) do
    "#{prefix}.#{FieldNames.lower_camel(field)}"
  end
end
