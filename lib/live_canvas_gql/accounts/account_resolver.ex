defmodule LCGQL.Accounts.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.Accounts
  alias LCGQL.Relay
  alias LCSchemas.Accounts.User

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type mutation_payload :: %{
          user: User.t() | nil,
          errors: [mutation_error()]
        }
  @type mutation_result :: {:ok, mutation_payload()}
  @type user_lookup_error :: :invalid_id | :invalid_type | :not_found
  @type user_lookup_result :: {:ok, User.t()} | {:error, user_lookup_error()}
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
            optional(:user_id) => term(),
            optional(:phone_number) => String.t()
          },
          term()
        ) :: mutation_result()
  def attach_user_phone_number(parent, %{input: input}, resolution),
    do: attach_user_phone_number(parent, input, resolution)

  def attach_user_phone_number(
        _parent,
        %{user_id: user_id, phone_number: phone_number},
        _resolution
      ) do
    with {:ok, user} <- fetch_user(user_id),
         {:ok, _user_phone_number} <- Accounts.attach_user_phone_number(user, phone_number) do
      {:ok, %{user: Accounts.get_user!(user.id), errors: []}}
    else
      {:error, :invalid_id} ->
        {:ok, %{user: nil, errors: [%{field: "userId", message: "is invalid"}]}}

      {:error, :invalid_type} ->
        {:ok, %{user: nil, errors: [%{field: "userId", message: "has an invalid type"}]}}

      {:error, :not_found} ->
        {:ok, %{user: nil, errors: [%{field: "userId", message: "does not exist"}]}}

      {:error, :invalid_phone_number} ->
        {:ok, %{user: nil, errors: [%{field: "phoneNumber", message: "is invalid"}]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{user: nil, errors: format_changeset_errors(changeset)}}
    end
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

  @spec fetch_user(term()) :: user_lookup_result()
  defp fetch_user(user_id) do
    with {:ok, id} <- Relay.decode_global_id(user_id, :user, LCGQL.Schema) do
      try do
        {:ok, Accounts.get_user!(id)}
      rescue
        Ecto.NoResultsError -> {:error, :not_found}
      end
    end
  end

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

  @spec contact_match_node(LC.Accounts.contact_match()) :: contact_match_node()
  defp contact_match_node(%{contact_entry: %{id: id}} = contact_match) do
    Map.put(contact_match, :id, id)
  end
end
