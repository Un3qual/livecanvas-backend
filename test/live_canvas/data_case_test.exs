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

  test "capture_repo_queries/1 includes queries from sandbox-allowed worker processes" do
    user = user_fixture()
    test_pid = self()

    {loaded_user, queries} =
      capture_repo_queries(fn capture_participant ->
        worker_pid =
          spawn(fn ->
            receive do
              :load_user ->
                loaded_user = capture_participant.(fn -> Repo.get!(User, user.id) end)
                send(test_pid, {:loaded_user, loaded_user})
            end
          end)

        :ok = Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), worker_pid)
        send(worker_pid, :load_user)
        assert_receive {:loaded_user, loaded_user}
        loaded_user
      end)

    assert loaded_user.id == user.id
    assert count_table_queries(queries, "users") == 1
  end

  test "capture_repo_queries/1 excludes unregistered worker queries" do
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
