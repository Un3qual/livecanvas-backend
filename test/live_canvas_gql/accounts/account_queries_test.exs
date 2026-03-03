defmodule LCGQL.Accounts.AccountQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures
  alias LC.Accounts

  describe "viewer" do
    test "returns the current scoped user without requiring a userId argument" do
      user = user_fixture()
      expected_email = user.email
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(user)}

      query = """
      query {
        viewer {
          id
          email
        }
      }
      """

      assert {:ok, %{data: %{"viewer" => %{"id" => ^user_id, "email" => ^expected_email}}}} =
               Absinthe.run(query, LCGQL.Schema, context: context)
    end
  end

  describe "viewer.userIdentities" do
    test "returns relay edges and pageInfo using forward pagination" do
      user = user_fixture()
      _identity_1 = attach_user_identity(user, :google_provider, "google-1")
      _identity_2 = attach_user_identity(user, :apple_provider, "apple-1")

      query = """
      query($first: Int!, $after: String) {
        viewer {
          userIdentities(first: $first, after: $after) {
            edges {
              cursor
              node {
                id
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(user)}

      assert {:ok, %{data: %{"viewer" => %{"userIdentities" => first_page}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 1}, context: context)

      assert [%{"cursor" => first_cursor, "node" => %{"id" => first_id}}] = first_page["edges"]
      assert is_binary(first_cursor)
      assert is_binary(first_id)
      assert %{"hasNextPage" => true, "endCursor" => end_cursor} = first_page["pageInfo"]
      assert is_binary(end_cursor)

      assert {:ok, %{data: %{"viewer" => %{"userIdentities" => second_page}}}} =
               Absinthe.run(
                 query,
                 LCGQL.Schema,
                 variables: %{"first" => 1, "after" => end_cursor},
                 context: context
               )

      assert [%{"cursor" => second_cursor, "node" => %{"id" => second_id}}] = second_page["edges"]
      assert is_binary(second_cursor)
      assert is_binary(second_id)
      assert first_id != second_id
      assert second_page["pageInfo"]["hasNextPage"] == false
    end
  end

  describe "schema cleanup" do
    test "does not expose the legacy authTokenValid stub" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "authTokenValid"
      refute schema_sdl =~ "viewer(userId:"
    end
  end
end
