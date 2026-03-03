defmodule LCGQL.Accounts.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.Accounts
  alias LCGQL.Relay
  alias LCSchemas.Accounts.User

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type mutation_payload :: %{
          user: User.t() | nil,
          errors: [mutation_error()],
          successful: boolean()
        }
  @type mutation_result :: {:ok, mutation_payload()}
  @type user_lookup_error :: :invalid_id | :invalid_type | :not_found
  @type user_lookup_result :: {:ok, User.t()} | {:error, user_lookup_error()}

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
        {:ok, %{user: user, errors: [], successful: true}}

      {:error, changeset} ->
        {:ok, %{user: nil, errors: format_changeset_errors(changeset), successful: false}}
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
      {:ok, %{user: Accounts.get_user!(user.id), errors: [], successful: true}}
    else
      {:error, :invalid_id} ->
        {:ok,
         %{user: nil, errors: [%{field: "userId", message: "is invalid"}], successful: false}}

      {:error, :invalid_type} ->
        {:ok,
         %{
           user: nil,
           errors: [%{field: "userId", message: "has an invalid type"}],
           successful: false
         }}

      {:error, :not_found} ->
        {:ok,
         %{user: nil, errors: [%{field: "userId", message: "does not exist"}], successful: false}}

      {:error, :invalid_phone_number} ->
        {:ok,
         %{user: nil, errors: [%{field: "phoneNumber", message: "is invalid"}], successful: false}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{user: nil, errors: format_changeset_errors(changeset), successful: false}}
    end
  end

  @spec viewer(term(), %{optional(:user_id) => term()}, Absinthe.Resolution.t()) ::
          {:ok, User.t() | nil}
  def viewer(_parent, %{user_id: user_id}, _resolution) do
    case fetch_user(user_id) do
      {:ok, user} -> {:ok, user}
      {:error, _reason} -> {:ok, nil}
    end
  end

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
end
