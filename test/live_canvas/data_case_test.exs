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
end
