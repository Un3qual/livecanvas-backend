defmodule LCGQL.Accounts.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.Accounts
  alias LCSchemas.Accounts.User

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type mutation_payload :: %{
          user: User.t() | nil,
          errors: [mutation_error()]
        }
  @type mutation_result :: {:ok, mutation_payload()}
  @type contact_upsert_payload :: %{
          contact_match: LC.Accounts.contact_match() | nil,
          errors: [mutation_error()]
        }
  @type contact_upsert_result :: {:ok, contact_upsert_payload()}
  @type invite_delivery_payload :: %{errors: [mutation_error()]}
  @type invite_delivery_result :: {:ok, invite_delivery_payload()}
  @type auth_token_payload :: %{
          access_token: map() | nil,
          refresh_token: map() | nil,
          errors: [mutation_error()]
        }
  @type auth_token_result :: {:ok, auth_token_payload()}
  @type revoke_refresh_payload :: %{revoked: boolean(), errors: [mutation_error()]}
  @type revoke_refresh_result :: {:ok, revoke_refresh_payload()}
  @type contact_upsert_error_reason ::
          :invalid_contact_client_id
          | :invalid_birthday
          | :invalid_phone_number
          | :invalid_email_list
  @type invite_delivery_error_reason :: :invalid_recipient | :unauthenticated | :delivery_failed
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
  @spec contact_invite_url(String.t()) :: String.t()
  defp contact_invite_url(token), do: "https://livecanvas.invalid/invites/#{token}"

  @spec invite_delivery_error(invite_delivery_error_reason()) :: mutation_error()
  defp invite_delivery_error(:invalid_recipient),
    do: %{field: "recipient", message: "is invalid"}

  defp invite_delivery_error(:unauthenticated),
    do: %{field: nil, message: "unauthenticated"}

  defp invite_delivery_error(:delivery_failed),
    do: %{field: nil, message: "delivery_failed"}

  @spec refresh_auth_error(refresh_auth_error_reason()) :: mutation_error()
  defp refresh_auth_error(reason),
    do: %{field: "refreshToken", message: Atom.to_string(reason)}

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

  @spec contact_match_node(LC.Accounts.contact_match()) :: contact_match_node()
  defp contact_match_node(%{contact_entry: %{id: id}} = contact_match) do
    Map.put(contact_match, :id, id)
  end
end
