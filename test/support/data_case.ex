defmodule LC.DataCase do
  @moduledoc """
  This module defines the setup for tests requiring
  access to the application's data layer.

  You may define functions here to be used as helpers in
  your tests.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use LC.DataCase, async: true`, although
  this option is not recommended for other databases.
  """

  use ExUnit.CaseTemplate

  alias LC.Accounts

  using do
    quote do
      alias LC.Infra.Repo

      import Ecto
      import Ecto.Changeset
      import Ecto.Query
      import LC.DataCase
    end
  end

  setup tags do
    LC.DataCase.setup_sandbox(tags)
    :ok
  end

  @doc """
  Sets up the sandbox based on the test tags.
  """
  def setup_sandbox(tags) do
    pid =
      Ecto.Adapters.SQL.Sandbox.start_owner!(LC.Infra.Repo, shared: not tags[:async])

    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  end

  @doc """
  A helper that transforms changeset errors into a map of messages.

      assert {:error, changeset} = Accounts.create_user(%{password: "short"})
      assert "password is too short" in errors_on(changeset).password
      assert %{password: ["password is too short"]} = errors_on(changeset)

  """
  def errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end

  @doc """
  Builds an authenticated scope for the given user by round-tripping a session token.
  """
  def authenticated_scope(%{id: user_id} = user) when is_integer(user_id) do
    token = Accounts.generate_user_session_token(user)

    case Accounts.get_user_by_session_token(token) do
      {%{id: loaded_user_id} = loaded_user, _inserted_at} when is_integer(loaded_user_id) ->
        Accounts.scope_for_user(loaded_user)

      nil ->
        raise "expected a valid user session token for user #{user_id}"
    end
  end
end
