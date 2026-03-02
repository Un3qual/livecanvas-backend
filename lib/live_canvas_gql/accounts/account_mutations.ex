defmodule LiveCanvasGQL.Accounts.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LiveCanvas.Accounts

  object :account_mutations do
    field :register_with_email, non_null(:successful_payload) do
      arg(:input, non_null(:register_with_email_input))

      resolve(&register_with_email/3)
    end

    field :attach_user_phone_number, non_null(:successful_payload) do
      arg(:input, non_null(:attach_user_phone_number_input))

      resolve(&attach_user_phone_number/3)
    end

    @desc "Logs in or signs up a user with Apple"
    payload field :apple_authenticate do
      # deprecate "All new GraphQL clients should use the `providerAuthenticate` mutation."

      input do
        field :identity_token, non_null(:string)
        field :authorization_code, non_null(:string)
        field :uid, non_null(:string)
      end

      output do
        field :successful, non_null(:boolean)
        field :result, :integer
      end

      resolve(fn _parent, _args, _res ->
        {:ok, %{successful: true, result: 123}}
      end)

      # resolve &Resolver.apple_authenticate/2
      # middleware &build_payload/2
    end
  end

  defp register_with_email(_parent, %{input: %{email: email}}, _resolution) do
    case Accounts.register_user_with_email(%{email: email}) do
      {:ok, _user} -> {:ok, %{successful: true}}
      {:error, _changeset} -> {:ok, %{successful: false}}
    end
  end

  defp attach_user_phone_number(
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

  defp fetch_user(user_id) do
    with {:ok, id} <- parse_id(user_id) do
      try do
        {:ok, Accounts.get_user!(id)}
      rescue
        Ecto.NoResultsError -> {:error, :not_found}
      end
    end
  end

  defp parse_id(user_id) when is_integer(user_id), do: {:ok, user_id}

  defp parse_id(user_id) when is_binary(user_id) do
    case Integer.parse(user_id) do
      {id, ""} -> {:ok, id}
      _ -> {:error, :invalid_id}
    end
  end

  defp parse_id(_user_id), do: {:error, :invalid_id}
end
