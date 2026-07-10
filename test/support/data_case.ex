defmodule LC.DataCase do
  @moduledoc """
  Data tests run inside the SQL sandbox and import the repo/query helpers used by
  context-level test cases.
  """

  use ExUnit.CaseTemplate

  alias LC.Accounts
  alias LC.Infra.Repo

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

  @doc """
  Captures repo query SQL strings executed while `fun` runs.

  Repo telemetry handlers are VM-global, so callers must use synchronous
  ExUnit cases. This lets the capture include queries from any worker process
  started and awaited by `fun` without collecting unrelated test traffic.
  """
  @spec capture_repo_queries((-> result)) :: {result, [String.t()]} when result: var
  def capture_repo_queries(fun) when is_function(fun, 0) do
    handler_id = {__MODULE__, self(), System.unique_integer([:positive])}

    :ok =
      :telemetry.attach(
        handler_id,
        repo_query_event_name(),
        &__MODULE__.handle_repo_query_event/4,
        self()
      )

    try do
      {fun.(), drain_repo_query_events([])}
    after
      :telemetry.detach(handler_id)
    end
  end

  @doc """
  Counts captured queries that touch the named table.
  """
  @spec count_table_queries([String.t()], String.t()) :: non_neg_integer()
  def count_table_queries(queries, table_name)
      when is_list(queries) and is_binary(table_name) do
    pattern = ~r/\b(?:FROM|JOIN)\s+"#{Regex.escape(table_name)}"/i

    Enum.count(queries, fn query ->
      Regex.match?(pattern, query)
    end)
  end

  @doc false
  @spec handle_repo_query_event([atom()], map(), map(), pid()) :: :ok
  def handle_repo_query_event(_event, _measurements, %{query: query}, test_pid)
      when is_pid(test_pid) do
    send(test_pid, {:repo_query_event, IO.iodata_to_binary(query)})
    :ok
  end

  def handle_repo_query_event(_event, _measurements, _metadata, _test_pid), do: :ok

  @spec repo_query_event_name() :: [atom()]
  defp repo_query_event_name do
    Keyword.fetch!(Repo.config(), :telemetry_prefix) ++ [:query]
  end

  @spec drain_repo_query_events([String.t()]) :: [String.t()]
  defp drain_repo_query_events(acc) do
    receive do
      {:repo_query_event, query} ->
        drain_repo_query_events([query | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end
end
