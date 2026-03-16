defmodule LCGQL.Accounts.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.Accounts
  alias LCGQL.Relay
  alias LCSchemas.Accounts.{User, UserIdentity}

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type auth_error_code ::
          :unauthenticated
          | :invalid_input
          | :invalid_credentials
          | :email_taken
          | :token_expired
          | :token_revoked
          | :unsupported_provider
          | :provider_verification_failed
          | :passkey_verification_failed
  @type auth_error :: %{field: String.t() | nil, code: auth_error_code(), message: String.t()}
  @type mutation_payload :: %{
          user: User.t() | nil,
          errors: [mutation_error()]
        }
  @type mutation_result :: {:ok, mutation_payload()}
  @type password_reset_request_payload :: %{errors: [mutation_error()]}
  @type password_reset_request_result :: {:ok, password_reset_request_payload()}
  @type password_reset_payload :: %{reset: boolean(), errors: [mutation_error()]}
  @type password_reset_mutation_result :: {:ok, password_reset_payload()}
  @type data_export_request_payload :: %{
          data_export_request: map() | nil,
          errors: [mutation_error()]
        }
  @type data_export_request_result :: {:ok, data_export_request_payload()}
  @type account_deletion_request_payload :: %{
          account_deletion_request: map() | nil,
          errors: [mutation_error()]
        }
  @type account_deletion_request_result :: {:ok, account_deletion_request_payload()}
  @type unlink_identity_payload :: %{
          user_identity: UserIdentity.t() | nil,
          errors: [mutation_error()]
        }
  @type unlink_identity_result :: {:ok, unlink_identity_payload()}
  @type contact_upsert_payload :: %{
          contact_match: LC.Accounts.contact_match() | nil,
          errors: [mutation_error()]
        }
  @type contact_upsert_result :: {:ok, contact_upsert_payload()}
  @type invite_delivery_payload :: %{errors: [mutation_error()]}
  @type invite_delivery_result :: {:ok, invite_delivery_payload()}
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
  @type contact_upsert_error_reason ::
          :invalid_contact_client_id
          | :invalid_birthday
          | :invalid_phone_number
          | :invalid_email_list
  @type data_export_error_reason :: :enqueue_failed | :unauthenticated
  @type account_deletion_error_reason ::
          :enqueue_failed
          | :unauthenticated
          | :not_found
          | :already_processing
          | :cannot_cancel
          | :invalid_request_id
  @type unlink_identity_error_reason ::
          :invalid_identity_id | :not_found | :already_revoked | :unauthenticated
  @type invite_delivery_error_reason :: :invalid_recipient | :unauthenticated | :delivery_failed
  @type reset_password_error_reason :: :invalid_or_expired
  @type refresh_auth_error_reason :: :invalid_token | :expired_token | :revoked_token
  @type token_view :: %{
          serialized_value: String.t(),
          token_version: integer(),
          expires_at: String.t() | nil,
          inserted_at: String.t() | nil,
          updated_at: String.t() | nil
        }
  @type contact_match_node :: %{
          id: pos_integer(),
          contact_entry: map(),
          matched_users: [User.t()]
        }

  @spec register_with_email(
          term(),
          %{optional(:input) => map(), optional(:email) => String.t()},
          term()
        ) ::
          mutation_result()
  def register_with_email(parent, %{input: input}, resolution),
    do: register_with_email(parent, input, resolution)

  def register_with_email(_parent, %{email: email}, _resolution) do
    case Accounts.register_user_with_email(%{email: email}) do
      {:ok, user} ->
        {:ok, %{user: user, errors: []}}

      {:error, changeset} ->
        {:ok, %{user: nil, errors: format_changeset_errors(changeset)}}
    end
  end

  @spec attach_user_phone_number(
          term(),
          %{
            optional(:input) => map(),
            optional(:phone_number) => String.t()
          },
          Absinthe.Resolution.t()
        ) :: mutation_result()
  def attach_user_phone_number(parent, %{input: input}, resolution),
    do: attach_user_phone_number(parent, input, resolution)

  def attach_user_phone_number(
        _parent,
        %{phone_number: phone_number},
        %{context: %{current_scope: %{user: %{id: _id} = user}}}
      ) do
    with {:ok, _user_phone_number} <- Accounts.attach_user_phone_number(user, phone_number) do
      {:ok, %{user: Accounts.get_user!(user.id), errors: []}}
    else
      {:error, :invalid_phone_number} ->
        {:ok, %{user: nil, errors: [%{field: "phoneNumber", message: "is invalid"}]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{user: nil, errors: format_changeset_errors(changeset)}}
    end
  end

  # Viewer-scoped phone attachment prevents clients from mutating other users'
  # phone bindings by passing arbitrary user IDs into the GraphQL payload.
  def attach_user_phone_number(_parent, _args, _resolution) do
    {:ok, %{user: nil, errors: [%{field: nil, message: "unauthenticated"}]}}
  end

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
        {:ok, %{reset: false, errors: format_changeset_errors(changeset)}}
    end
  end

  @spec unlink_viewer_identity(
          term(),
          %{optional(:input) => map(), optional(:user_identity_id) => String.t()},
          Absinthe.Resolution.t()
        ) :: unlink_identity_result()
  def unlink_viewer_identity(parent, %{input: input}, resolution),
    do: unlink_viewer_identity(parent, input, resolution)

  def unlink_viewer_identity(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, identity_id} <- decode_user_identity_id(args),
         {:ok, user_identity} <- Accounts.unlink_user_identity(user, identity_id) do
      {:ok, %{user_identity: user_identity, errors: []}}
    else
      {:error, :invalid_id} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:invalid_identity_id)]}}

      {:error, :invalid_type} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:invalid_identity_id)]}}

      {:error, :not_found} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:not_found)]}}

      {:error, :already_revoked} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:already_revoked)]}}
    end
  end

  def unlink_viewer_identity(_parent, _args, _resolution) do
    {:ok, %{user_identity: nil, errors: [unlink_identity_error(:unauthenticated)]}}
  end

  @spec request_viewer_data_export(
          term(),
          %{optional(:input) => map(), optional(:format) => atom()},
          Absinthe.Resolution.t()
        ) :: data_export_request_result()
  def request_viewer_data_export(parent, %{input: input}, resolution),
    do: request_viewer_data_export(parent, input, resolution)

  def request_viewer_data_export(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    format = Map.get(args, :format, :json)

    case Accounts.request_user_data_export(user, format: format) do
      {:ok, request} ->
        {:ok, %{data_export_request: request, errors: []}}

      {:error, :enqueue_failed} ->
        {:ok, %{data_export_request: nil, errors: [data_export_error(:enqueue_failed)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{data_export_request: nil, errors: format_changeset_errors(changeset)}}
    end
  end

  def request_viewer_data_export(_parent, _args, _resolution) do
    {:ok, %{data_export_request: nil, errors: [data_export_error(:unauthenticated)]}}
  end

  @spec request_viewer_account_deletion(
          term(),
          %{optional(:input) => map(), optional(:grace_period_seconds) => integer()},
          Absinthe.Resolution.t()
        ) :: account_deletion_request_result()
  def request_viewer_account_deletion(parent, %{input: input}, resolution),
    do: request_viewer_account_deletion(parent, input, resolution)

  def request_viewer_account_deletion(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    case Accounts.request_user_account_deletion(user, account_deletion_request_opts(args)) do
      {:ok, request} ->
        {:ok, %{account_deletion_request: request, errors: []}}

      {:error, :enqueue_failed} ->
        {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:enqueue_failed)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{account_deletion_request: nil, errors: format_changeset_errors(changeset)}}
    end
  end

  def request_viewer_account_deletion(_parent, _args, _resolution) do
    {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:unauthenticated)]}}
  end

  @spec cancel_viewer_account_deletion_request(
          term(),
          %{optional(:input) => map(), optional(:account_deletion_request_id) => String.t()},
          Absinthe.Resolution.t()
        ) :: account_deletion_request_result()
  def cancel_viewer_account_deletion_request(parent, %{input: input}, resolution),
    do: cancel_viewer_account_deletion_request(parent, input, resolution)

  def cancel_viewer_account_deletion_request(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, request_id} <- decode_account_deletion_request_id(args),
         {:ok, request} <- Accounts.cancel_user_account_deletion_request(user, request_id) do
      {:ok, %{account_deletion_request: request, errors: []}}
    else
      {:error, :invalid_id} ->
        {:ok,
         %{
           account_deletion_request: nil,
           errors: [account_deletion_error(:invalid_request_id)]
         }}

      {:error, :invalid_type} ->
        {:ok,
         %{
           account_deletion_request: nil,
           errors: [account_deletion_error(:invalid_request_id)]
         }}

      {:error, :not_found} ->
        {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:not_found)]}}

      {:error, :already_processing} ->
        {:ok,
         %{account_deletion_request: nil, errors: [account_deletion_error(:already_processing)]}}

      {:error, :cannot_cancel} ->
        {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:cannot_cancel)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{account_deletion_request: nil, errors: format_changeset_errors(changeset)}}
    end
  end

  def cancel_viewer_account_deletion_request(_parent, _args, _resolution) do
    {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:unauthenticated)]}}
  end

  @spec upsert_viewer_contact_entry(
          term(),
          %{
            optional(:input) => map(),
            optional(:contact_client_id) => String.t(),
            optional(:contact_name) => String.t(),
            optional(:birthday) => String.t(),
            optional(:emails) => [String.t()] | nil,
            optional(:phone_numbers) => [String.t()] | nil
          },
          Absinthe.Resolution.t()
        ) :: contact_upsert_result()
  def upsert_viewer_contact_entry(parent, %{input: input}, resolution),
    do: upsert_viewer_contact_entry(parent, input, resolution)

  def upsert_viewer_contact_entry(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    contact_attrs = %{
      contact_client_id: Map.get(args, :contact_client_id),
      contact_name: Map.get(args, :contact_name),
      birthday: Map.get(args, :birthday),
      emails: normalize_string_list(Map.get(args, :emails)),
      phone_numbers: normalize_string_list(Map.get(args, :phone_numbers))
    }

    case Accounts.upsert_user_contact_entry(user, contact_attrs) do
      {:ok, contact_entry} ->
        {:ok,
         %{contact_match: Accounts.get_user_contact_match(user, contact_entry.id), errors: []}}

      {:error, reason} ->
        {:ok, %{contact_match: nil, errors: [contact_upsert_error(reason)]}}
    end
  end

  def upsert_viewer_contact_entry(_parent, _args, _resolution) do
    {:ok, %{contact_match: nil, errors: [%{field: nil, message: "unauthenticated"}]}}
  end

  @spec deliver_viewer_contact_invite(
          term(),
          %{optional(:input) => map(), optional(:recipient) => String.t()},
          Absinthe.Resolution.t()
        ) :: invite_delivery_result()
  def deliver_viewer_contact_invite(parent, %{input: input}, resolution),
    do: deliver_viewer_contact_invite(parent, input, resolution)

  def deliver_viewer_contact_invite(_parent, %{recipient: recipient}, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, normalized_recipient} <- normalize_invite_recipient(recipient),
         {:ok, _email} <-
           Accounts.deliver_contact_invite_instructions(
             user,
             normalized_recipient,
             &contact_invite_url/1
           ) do
      {:ok, %{errors: []}}
    else
      {:error, :invalid_recipient} ->
        {:ok, %{errors: [invite_delivery_error(:invalid_recipient)]}}

      {:error, _reason} ->
        {:ok, %{errors: [invite_delivery_error(:delivery_failed)]}}
    end
  end

  def deliver_viewer_contact_invite(_parent, _args, _resolution) do
    {:ok, %{errors: [invite_delivery_error(:unauthenticated)]}}
  end

  @spec begin_auth_challenge(
          term(),
          map(),
          Absinthe.Resolution.t()
        ) :: auth_challenge_result()
  def begin_auth_challenge(parent, %{input: input}, resolution),
    do: begin_auth_challenge(parent, input, resolution)

  def begin_auth_challenge(_parent, %{provider: :password}, _resolution) do
    {:ok, %{challenge: nil, errors: [auth_error("provider", :unsupported_provider)]}}
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
             errors: [auth_error("magicLink.email", :email_taken, "has already been taken")]
           }}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok, %{challenge: nil, errors: format_auth_changeset_errors(changeset, "magicLink")}}
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
       errors: [auth_error(nil, :invalid_input)]
     }}
  end

  def begin_auth_challenge(_parent, _args, _resolution) do
    {:ok, %{challenge: nil, errors: [auth_error(nil, :invalid_input)]}}
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
             auth_error("password.email", :email_taken, "has already been taken")
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok, auth_entry_error_payload(format_auth_changeset_errors(changeset, "password"))}

        {:error, :invalid_credentials} ->
          {:ok, auth_entry_error_payload([auth_error(nil, :invalid_input)])}
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
             auth_error("magicLink.token", :invalid_credentials)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok, auth_entry_error_payload(format_auth_changeset_errors(changeset, "magicLink"))}

        {:error, :email_taken} ->
          {:ok,
           auth_entry_error_payload([
             auth_error("magicLink.email", :email_taken, "has already been taken")
           ])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def sign_up(_parent, _args, _resolution) do
    {:ok, auth_entry_error_payload([auth_error(nil, :invalid_input)])}
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
             auth_error("password.password", :invalid_credentials)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok, auth_entry_error_payload(format_auth_changeset_errors(changeset, "password"))}

        {:error, :email_taken} ->
          {:ok, auth_entry_error_payload([auth_error(nil, :invalid_input)])}
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
             auth_error("magicLink.token", :invalid_credentials)
           ])}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:ok, auth_entry_error_payload(format_auth_changeset_errors(changeset, "magicLink"))}

        {:error, :email_taken} ->
          {:ok, auth_entry_error_payload([auth_error(nil, :invalid_input)])}
      end
    else
      {:error, auth_error} ->
        {:ok, auth_entry_error_payload([auth_error])}
    end
  end

  def log_in(_parent, _args, _resolution) do
    {:ok, auth_entry_error_payload([auth_error(nil, :invalid_input)])}
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
           errors: [%{field: nil, message: "invalid_token"}]
         }}
    end
  end

  def issue_viewer_auth_tokens(_parent, _args, _resolution) do
    {:ok,
     %{access_token: nil, refresh_token: nil, errors: [%{field: nil, message: "unauthenticated"}]}}
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

  @spec user_identity_auth_provider(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, :google | :apple | :passkey}
  def user_identity_auth_provider(%{provider: provider}, _args, _resolution) do
    {:ok, auth_provider_value!(provider)}
  end

  @spec user_identity_oauth_provider(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, :google | :apple | nil}
  def user_identity_oauth_provider(%{provider: provider}, _args, _resolution) do
    {:ok, oauth_provider_value!(provider)}
  end

  @spec viewer(term(), map(), Absinthe.Resolution.t()) :: {:ok, User.t() | nil}

  def viewer(_parent, _args, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    {:ok, user}
  end

  def viewer(_parent, _args, _resolution), do: {:ok, nil}

  @spec user_identities(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def user_identities(%{id: _id} = user, args, _resolution) do
    query = Accounts.user_identities_query(user)
    Absinthe.Relay.Connection.from_query(query, &Accounts.run_query/1, args)
  end

  @spec viewer_contact_matches(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_contact_matches(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    user
    |> Accounts.list_user_contact_matches()
    |> Enum.map(&contact_match_node/1)
    |> Absinthe.Relay.Connection.from_list(args)
  end

  def viewer_contact_matches(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
  end

  @spec viewer_data_export_requests(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_data_export_requests(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    user
    |> Accounts.list_user_data_export_requests()
    |> Absinthe.Relay.Connection.from_list(args)
  end

  def viewer_data_export_requests(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
  end

  @spec contact_match_name(contact_match_node(), map(), Absinthe.Resolution.t()) ::
          {:ok, String.t() | nil}
  def contact_match_name(%{contact_entry: %{contact_name: contact_name}}, _args, _res),
    do: {:ok, contact_name}

  @spec contact_match_birthday(contact_match_node(), map(), Absinthe.Resolution.t()) ::
          {:ok, String.t() | nil}
  def contact_match_birthday(%{contact_entry: %{birthday: nil}}, _args, _res),
    do: {:ok, nil}

  def contact_match_birthday(%{contact_entry: %{birthday: birthday}}, _args, _res),
    do: {:ok, Date.to_iso8601(birthday)}

  @spec data_export_requested_at(
          %{requested_at: DateTime.t() | nil},
          map(),
          Absinthe.Resolution.t()
        ) ::
          {:ok, String.t()}
  def data_export_requested_at(%{requested_at: requested_at}, _args, _resolution),
    do: {:ok, iso8601_datetime(requested_at) || ""}

  @spec data_export_completed_at(
          %{completed_at: DateTime.t() | nil},
          map(),
          Absinthe.Resolution.t()
        ) ::
          {:ok, String.t() | nil}
  def data_export_completed_at(%{completed_at: completed_at}, _args, _resolution),
    do: {:ok, iso8601_datetime(completed_at)}

  @spec account_deletion_requested_at(
          %{requested_at: DateTime.t() | nil},
          map(),
          Absinthe.Resolution.t()
        ) ::
          {:ok, String.t()}
  def account_deletion_requested_at(%{requested_at: requested_at}, _args, _resolution),
    do: {:ok, iso8601_datetime(requested_at) || ""}

  @spec account_deletion_scheduled_purge_at(
          %{scheduled_purge_at: DateTime.t() | nil},
          map(),
          Absinthe.Resolution.t()
        ) ::
          {:ok, String.t()}
  def account_deletion_scheduled_purge_at(
        %{scheduled_purge_at: scheduled_purge_at},
        _args,
        _resolution
      ),
      do: {:ok, iso8601_datetime(scheduled_purge_at) || ""}

  @spec account_deletion_completed_at(
          %{completed_at: DateTime.t() | nil},
          map(),
          Absinthe.Resolution.t()
        ) ::
          {:ok, String.t() | nil}
  def account_deletion_completed_at(%{completed_at: completed_at}, _args, _resolution),
    do: {:ok, iso8601_datetime(completed_at)}

  @spec format_changeset_errors(Ecto.Changeset.t()) :: [mutation_error()]
  defp format_changeset_errors(changeset) do
    changeset
    |> traverse_errors(fn {message, options} ->
      Enum.reduce(options, message, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.flat_map(fn {field, messages} ->
      Enum.map(messages, fn message ->
        %{field: to_string(field), message: message}
      end)
    end)
  end

  @spec contact_upsert_error(contact_upsert_error_reason()) :: mutation_error()
  defp contact_upsert_error(:invalid_contact_client_id),
    do: %{field: "contactClientId", message: "is invalid"}

  defp contact_upsert_error(:invalid_birthday), do: %{field: "birthday", message: "is invalid"}

  defp contact_upsert_error(:invalid_phone_number),
    do: %{field: "phoneNumbers", message: "is invalid"}

  defp contact_upsert_error(:invalid_email_list), do: %{field: "emails", message: "is invalid"}

  @spec data_export_error(data_export_error_reason()) :: mutation_error()
  defp data_export_error(:enqueue_failed),
    do: %{field: nil, message: "export_unavailable"}

  defp data_export_error(:unauthenticated),
    do: %{field: nil, message: "unauthenticated"}

  @spec account_deletion_error(account_deletion_error_reason()) :: mutation_error()
  defp account_deletion_error(:enqueue_failed),
    do: %{field: nil, message: "deletion_unavailable"}

  defp account_deletion_error(:unauthenticated),
    do: %{field: nil, message: "unauthenticated"}

  defp account_deletion_error(:not_found),
    do: %{field: nil, message: "not_found"}

  defp account_deletion_error(:already_processing),
    do: %{field: nil, message: "already_processing"}

  defp account_deletion_error(:cannot_cancel),
    do: %{field: nil, message: "cannot_cancel"}

  defp account_deletion_error(:invalid_request_id),
    do: %{field: "accountDeletionRequestId", message: "is invalid"}

  @spec unlink_identity_error(unlink_identity_error_reason()) :: mutation_error()
  defp unlink_identity_error(:invalid_identity_id),
    do: %{field: "userIdentityId", message: "is invalid"}

  defp unlink_identity_error(:not_found),
    do: %{field: nil, message: "not_found"}

  defp unlink_identity_error(:already_revoked),
    do: %{field: nil, message: "already_revoked"}

  defp unlink_identity_error(:unauthenticated),
    do: %{field: nil, message: "unauthenticated"}

  @spec decode_account_deletion_request_id(map()) ::
          {:ok, pos_integer()} | {:error, Relay.decode_error()}
  defp decode_account_deletion_request_id(args) when is_map(args) do
    args
    |> Map.get(:account_deletion_request_id)
    |> Relay.decode_global_id(:account_deletion_request, LCGQL.Schema)
  end

  @spec decode_user_identity_id(map()) :: {:ok, pos_integer()} | {:error, Relay.decode_error()}
  defp decode_user_identity_id(args) when is_map(args) do
    args
    |> Map.get(:user_identity_id)
    |> Relay.decode_global_id(:user_identity, LCGQL.Schema)
  end

  @spec account_deletion_request_opts(map()) ::
          [{:grace_period_seconds, non_neg_integer()} | {:job_max_attempts, pos_integer()}]
  defp account_deletion_request_opts(args) when is_map(args) do
    args
    |> Map.take([:grace_period_seconds, :job_max_attempts])
    |> Enum.to_list()
    |> Enum.filter(fn
      {:grace_period_seconds, value} when is_integer(value) and value >= 0 -> true
      {:job_max_attempts, value} when is_integer(value) and value > 0 -> true
      _ -> false
    end)
  end

  @spec normalize_string_list([String.t()] | nil) :: [String.t()]
  defp normalize_string_list(nil), do: []
  defp normalize_string_list(values), do: values

  @spec normalize_invite_recipient(term()) :: {:ok, String.t()} | {:error, :invalid_recipient}
  defp normalize_invite_recipient(recipient) when is_binary(recipient) do
    normalized_recipient = recipient |> String.trim() |> String.downcase()

    if Regex.match?(~r/^[^@\s]+@[^@\s]+$/, normalized_recipient) do
      {:ok, normalized_recipient}
    else
      {:error, :invalid_recipient}
    end
  end

  defp normalize_invite_recipient(_recipient), do: {:error, :invalid_recipient}

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec magic_link_url(String.t()) :: String.t()
  defp magic_link_url(token), do: "https://livecanvas.invalid/users/log-in/#{token}"

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec password_reset_url(String.t()) :: String.t()
  defp password_reset_url(token), do: "https://livecanvas.invalid/users/reset-password/#{token}"

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec contact_invite_url(String.t()) :: String.t()
  defp contact_invite_url(token), do: "https://livecanvas.invalid/invites/#{token}"

  defp auth_error(field, code, message \\ nil) do
    %{
      field: field,
      code: code,
      message: message || Atom.to_string(code)
    }
  end

  @spec auth_provider_value!(LCSchemas.Accounts.user_identity_provider()) ::
          :google | :apple | :passkey
  defp auth_provider_value!(:google_provider), do: :google
  defp auth_provider_value!(:apple_provider), do: :apple
  defp auth_provider_value!(:passkey_provider), do: :passkey

  defp auth_provider_value!(provider) do
    raise ArgumentError, "unsupported auth provider mapping for #{inspect(provider)}"
  end

  @spec oauth_provider_value!(LCSchemas.Accounts.user_identity_provider()) ::
          :google | :apple | nil
  defp oauth_provider_value!(:google_provider), do: :google
  defp oauth_provider_value!(:apple_provider), do: :apple
  defp oauth_provider_value!(:passkey_provider), do: nil

  defp oauth_provider_value!(provider) do
    raise ArgumentError, "unsupported oauth provider mapping for #{inspect(provider)}"
  end

  @spec blank?(term()) :: boolean()
  defp blank?(value), do: value in [nil, ""]

  @spec invite_delivery_error(invite_delivery_error_reason()) :: mutation_error()
  defp invite_delivery_error(:invalid_recipient),
    do: %{field: "recipient", message: "is invalid"}

  defp invite_delivery_error(:unauthenticated),
    do: %{field: nil, message: "unauthenticated"}

  defp invite_delivery_error(:delivery_failed),
    do: %{field: nil, message: "delivery_failed"}

  @spec reset_password_error(reset_password_error_reason()) :: mutation_error()
  defp reset_password_error(:invalid_or_expired),
    do: %{field: nil, message: "invalid_or_expired"}

  @spec refresh_auth_error(refresh_auth_error_reason()) :: mutation_error()
  defp refresh_auth_error(reason),
    do: %{field: "refreshToken", message: Atom.to_string(reason)}

  @spec auth_entry_payload(LC.Accounts.auth_entry_payload()) :: auth_entry_payload()
  defp auth_entry_payload(%{access_token: access_token, refresh_token: refresh_token}) do
    %{
      access_token: token_view(access_token),
      refresh_token: token_view(refresh_token),
      errors: []
    }
  end

  @spec auth_entry_error_payload([auth_error()]) :: auth_entry_payload()
  defp auth_entry_error_payload(errors) do
    %{access_token: nil, refresh_token: nil, errors: errors}
  end

  @spec require_auth_field(map(), atom(), String.t()) :: :ok | {:error, auth_error()}
  defp require_auth_field(input, field, prefix) when is_map(input) and is_atom(field) do
    if blank?(Map.get(input, field)) do
      {:error, auth_error(prefixed_auth_field(prefix, field), :invalid_input, "is required")}
    else
      :ok
    end
  end

  @spec format_auth_changeset_errors(Ecto.Changeset.t(), String.t()) :: [auth_error()]
  defp format_auth_changeset_errors(changeset, prefix) do
    changeset
    |> traverse_errors(fn {message, options} ->
      Enum.reduce(options, message, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.flat_map(fn {field, messages} ->
      Enum.map(messages, fn message ->
        auth_error(prefixed_auth_field(prefix, field), :invalid_input, message)
      end)
    end)
  end

  @spec token_view(LC.Accounts.token_payload()) :: token_view()
  defp token_view(%{token: serialized_value, user_token: user_token}) do
    %{
      serialized_value: serialized_value,
      token_version: 1,
      expires_at: nil,
      inserted_at: iso8601_datetime(user_token.inserted_at),
      updated_at: nil
    }
  end

  @spec iso8601_datetime(DateTime.t() | nil) :: String.t() | nil
  defp iso8601_datetime(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp iso8601_datetime(_dt), do: nil

  @spec prefixed_auth_field(String.t(), atom()) :: String.t()
  defp prefixed_auth_field(prefix, field) when is_binary(prefix) and is_atom(field) do
    "#{prefix}.#{camelize_lower(field)}"
  end

  @spec camelize_lower(atom()) :: String.t()
  defp camelize_lower(field) when is_atom(field) do
    field
    |> Atom.to_string()
    |> Macro.camelize()
    |> then(fn
      <<first::utf8, rest::binary>> -> String.downcase(<<first::utf8>>) <> rest
      "" -> ""
    end)
  end

  @spec contact_match_node(LC.Accounts.contact_match()) :: contact_match_node()
  defp contact_match_node(%{contact_entry: %{id: id}} = contact_match) do
    Map.put(contact_match, :id, id)
  end
end
