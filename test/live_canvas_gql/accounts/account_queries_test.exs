defmodule LCGQL.Accounts.AccountQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  describe "viewer" do
    test "returns the requested user by id" do
      user = user_fixture()
      expected_email = user.email

      query = """
      query($userId: ID!) {
        viewer(userId: $userId) {
          email
        }
      }
      """

      assert {:ok, %{data: %{"viewer" => %{"email" => ^expected_email}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"userId" => user.id})
    end
  end

  describe "schema cleanup" do
    test "does not expose the legacy authTokenValid stub" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "authTokenValid"
    end
  end
end
