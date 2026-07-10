defmodule LC.DataCaseTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LCSchemas.Accounts.User

  test "capture_repo_queries/1 includes queries from awaited tasks" do
    user = user_fixture()

    {loaded_user, queries} =
      capture_repo_queries(fn ->
        Task.async(fn -> Repo.get!(User, user.id) end)
        |> Task.await()
      end)

    assert loaded_user.id == user.id
    assert count_table_queries(queries, "users") == 1
  end

  test "capture_repo_queries/1 includes queries from participating worker processes" do
    user = user_fixture()

    {loaded_user, queries} =
      capture_repo_queries(fn ->
        test_pid = self()

        worker_pid =
          spawn(fn ->
            # Non-Task workers opt into the same caller chain used by Ecto's
            # sandbox and the scoped telemetry capture.
            Process.put(:"$callers", [test_pid])

            receive do
              :load_user -> send(test_pid, {:loaded_user, Repo.get!(User, user.id)})
            end
          end)

        send(worker_pid, :load_user)
        assert_receive {:loaded_user, loaded_user}
        loaded_user
      end)

    assert loaded_user.id == user.id
    assert count_table_queries(queries, "users") == 1
  end

  test "capture_repo_queries/1 excludes queries from unrelated processes" do
    captured_user = user_fixture()
    unrelated_user = user_fixture()
    test_pid = self()

    unrelated_worker =
      spawn(fn ->
        receive do
          :load_user -> send(test_pid, {:unrelated_user, Repo.get!(User, unrelated_user.id)})
        end
      end)

    :ok = Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), unrelated_worker)

    {loaded_user, queries} =
      capture_repo_queries(fn ->
        send(unrelated_worker, :load_user)
        assert_receive {:unrelated_user, _user}
        Repo.get!(User, captured_user.id)
      end)

    assert loaded_user.id == captured_user.id
    assert count_table_queries(queries, "users") == 1
  end
end
