defmodule LC.DataCaseTest do
  use LC.DataCase

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

  test "capture_repo_queries/1 includes queries from regular worker processes" do
    user = user_fixture()

    {loaded_user, queries} =
      capture_repo_queries(fn ->
        test_pid = self()

        worker_pid =
          spawn(fn ->
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
end
