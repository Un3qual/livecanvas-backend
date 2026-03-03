defmodule LCGQL.Accounts.AccountQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  describe "viewer" do
    test "returns the requested user by relay global id" do
      user = user_fixture()
      expected_email = user.email
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      query = """
      query($userId: ID!) {
        viewer(userId: $userId) {
          id
          email
        }
      }
      """

      assert {:ok, %{data: %{"viewer" => %{"id" => ^user_id, "email" => ^expected_email}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"userId" => user_id})
    end
  end

  describe "schema cleanup" do
    test "does not expose the legacy authTokenValid stub" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "authTokenValid"
    end
  end
end
