defmodule LiveCanvasGQL.Accounts.Resolver do
  alias LiveCanvas.Accounts

  def register_with_email(_parent, %{input: %{email: email}}, _resolution) do
    case Accounts.register_user_with_email(%{email: email}) do
      {:ok, _user} -> {:ok, %{successful: true}}
      {:error, _changeset} -> {:ok, %{successful: false}}
    end
  end

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

  def viewer(_parent, %{user_id: user_id}, _resolution) do
    case fetch_user(user_id) do
      {:ok, user} -> {:ok, user}
      {:error, _reason} -> {:ok, nil}
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
