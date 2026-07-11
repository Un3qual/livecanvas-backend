defmodule LC.DataCase do
  @moduledoc """
  Data tests run inside the SQL sandbox and import the repo/query helpers used by
  context-level test cases.
  """

  use ExUnit.CaseTemplate

  alias LC.Accounts
  alias LC.Infra.Repo

  @repo_query_capture_key {__MODULE__, :repo_query_capture_ref}

  @type repo_query_capture_participant :: ((-> term()) -> term())

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

  The handler accepts queries from the caller and processes that inherit its
  `$callers` chain. An arity-one callback receives a wrapper that raw workers
  can use around their Repo work to participate without changing `$callers`.
  This keeps async tests isolated while including awaited Tasks and explicitly
  participating workers.
  """
  @spec capture_repo_queries((-> result) | (repo_query_capture_participant() -> result)) ::
          {result, [String.t()]}
        when result: var
  def capture_repo_queries(fun) when is_function(fun, 0) do
    capture_repo_queries(fn _capture_participant -> fun.() end)
  end

  def capture_repo_queries(fun) when is_function(fun, 1) do
    test_pid = self()
    capture_ref = make_ref()
    handler_id = {__MODULE__, test_pid, capture_ref}
    capture_participant = &run_repo_query_capture_participant(&1, capture_ref)

    :ok =
      :telemetry.attach(
        handler_id,
        repo_query_event_name(),
        &__MODULE__.handle_repo_query_event/4,
        {test_pid, capture_ref}
      )

    result =
      try do
        fun.(capture_participant)
      after
        :telemetry.detach(handler_id)
      end

    {result, drain_repo_query_events(capture_ref, [])}
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
  @spec handle_repo_query_event([atom()], map(), map(), {pid(), reference()}) :: :ok
  def handle_repo_query_event(
        _event,
        _measurements,
        %{query: query},
        {test_pid, capture_ref}
      )
      when is_pid(test_pid) and is_reference(capture_ref) do
    if repo_query_capture_participant?(test_pid, capture_ref) do
      send(test_pid, {:repo_query_event, capture_ref, IO.iodata_to_binary(query)})
    end

    :ok
  end

  def handle_repo_query_event(_event, _measurements, _metadata, _handler_config), do: :ok

  @spec repo_query_event_name() :: [atom()]
  defp repo_query_event_name do
    Keyword.fetch!(Repo.config(), :telemetry_prefix) ++ [:query]
  end

  @spec drain_repo_query_events(reference(), [String.t()]) :: [String.t()]
  defp drain_repo_query_events(capture_ref, acc) do
    receive do
      {:repo_query_event, ^capture_ref, query} ->
        drain_repo_query_events(capture_ref, [query | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end

  @spec repo_query_capture_participant?(pid(), reference()) :: boolean()
  defp repo_query_capture_participant?(test_pid, capture_ref) do
    self() == test_pid or test_pid in Process.get(:"$callers", []) or
      Process.get(@repo_query_capture_key) == capture_ref
  end

  @spec run_repo_query_capture_participant((-> result), reference()) :: result when result: var
  defp run_repo_query_capture_participant(fun, capture_ref) when is_function(fun, 0) do
    missing = make_ref()
    previous = Process.get(@repo_query_capture_key, missing)
    Process.put(@repo_query_capture_key, capture_ref)

    try do
      fun.()
    after
      if previous == missing do
        Process.delete(@repo_query_capture_key)
      else
        Process.put(@repo_query_capture_key, previous)
      end
    end
  end
end
