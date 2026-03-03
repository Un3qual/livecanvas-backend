defmodule LCGQL.Accounts.Resolver do
  alias LC.Accounts
  alias LCGQL.Relay
  alias LCSchemas.Accounts.User

  @type mutation_payload :: %{successful: boolean()}
  @type mutation_result :: {:ok, mutation_payload()}
  @type user_lookup_error :: :invalid_id | :invalid_type | :not_found
  @type user_lookup_result :: {:ok, User.t()} | {:error, user_lookup_error()}

  @spec register_with_email(term(), %{input: %{email: String.t()}}, term()) :: mutation_result()
  def register_with_email(_parent, %{input: %{email: email}}, _resolution) do
    case Accounts.register_user_with_email(%{email: email}) do
      {:ok, _user} -> {:ok, %{successful: true}}
      {:error, _changeset} -> {:ok, %{successful: false}}
    end
  end

  @spec attach_user_phone_number(
          term(),
          %{input: %{user_id: term(), phone_number: String.t()}},
          term()
        ) :: mutation_result()
  def attach_user_phone_number(
        _parent,
        %{input: %{user_id: user_id, phone_number: phone_number}},
        _resolution
      ) do
    with {:ok, user} <- fetch_user(user_id),
         {:ok, _user_phone_number} <- Accounts.attach_user_phone_number(user, phone_number) do
      {:ok, %{successful: true}}
    else
      _ -> {:ok, %{successful: false}}
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
end
