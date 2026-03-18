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

    test "exposes privacyMode for the current scoped user" do
      user = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(user)}

      query = """
      query {
        viewer {
          privacyMode
        }
      }
      """

      assert {:ok, %{data: %{"viewer" => %{"privacyMode" => "PUBLIC"}}}} =
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

    test "exposes the linked user and batches repeated owner lookups" do
      user = user_fixture()
      _identity_1 = attach_user_identity(user, :google_provider, "google-linked-user-1")
      _identity_2 = attach_user_identity(user, :apple_provider, "apple-linked-user-1")

      query = """
      query($first: Int!) {
        viewer {
          userIdentities(first: $first) {
            edges {
              node {
                id
                user {
                  id
                }
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(user)}
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      {result, queries} =
        capture_repo_queries(fn ->
          Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
        end)

      assert {:ok, %{data: %{"viewer" => %{"userIdentities" => %{"edges" => edges}}}}} = result
      assert length(edges) == 2

      assert Enum.all?(edges, fn %{"node" => %{"user" => %{"id" => edge_user_id}}} ->
               edge_user_id == user_id
             end)

      assert count_table_queries(queries, "users") <= 1
    end

    test "returns only active identities after revocation" do
      user = user_fixture()
      _active_identity = attach_user_identity(user, :google_provider, "google-active-identity")

      revoked_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

      revoked_identity =
        attach_user_identity(user, :apple_provider, "apple-revoked-identity",
          revoked_at: revoked_at
        )

      query = """
      query($first: Int!) {
        viewer {
          userIdentities(first: $first) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(user)}

      assert {:ok, %{data: %{"viewer" => %{"userIdentities" => identities}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)

      assert [%{"node" => %{"id" => active_identity_id}}] = identities["edges"]

      revoked_identity_id =
        Absinthe.Relay.Node.to_global_id(:user_identity, revoked_identity.id, LCGQL.Schema)

      refute active_identity_id == revoked_identity_id
    end

    test "exposes authProvider for launch-supported identity types" do
      user = user_fixture()
      _google_identity = attach_user_identity(user, :google_provider, "google-auth-provider")
      _passkey_identity = attach_user_identity(user, :passkey_provider, "passkey-auth-provider")

      query = """
      query($first: Int!) {
        viewer {
          userIdentities(first: $first) {
            edges {
              node {
                provider
                authProvider
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(user)}

      assert {:ok, %{data: %{"viewer" => %{"userIdentities" => identities}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)

      assert Enum.map(identities["edges"], & &1["node"]) == [
               %{"provider" => "google_provider", "authProvider" => "GOOGLE"},
               %{"provider" => "passkey_provider", "authProvider" => "PASSKEY"}
             ]
    end

    test "keeps legacy identity providers queryable without raising" do
      user = user_fixture()
      _instagram_identity = attach_user_identity(user, :instagram_provider, "instagram-legacy")
      _snap_identity = attach_user_identity(user, :snap_provider, "snap-legacy")

      query = """
      query($first: Int!) {
        viewer {
          userIdentities(first: $first) {
            edges {
              node {
                provider
                authProvider
                oauthProvider
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(user)}

      assert {:ok, %{data: %{"viewer" => %{"userIdentities" => identities}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)

      assert Enum.map(identities["edges"], & &1["node"]) == [
               %{
                 "provider" => "instagram_provider",
                 "authProvider" => nil,
                 "oauthProvider" => "INSTAGRAM"
               },
               %{
                 "provider" => "snap_provider",
                 "authProvider" => nil,
                 "oauthProvider" => nil
               }
             ]
    end
  end

  describe "node(userIdentity)" do
    test "returns nil for revoked or unowned identity nodes" do
      viewer = user_fixture()
      outsider = user_fixture()

      revoked_identity =
        attach_user_identity(viewer, :google_provider, "google-node-revoked",
          revoked_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
        )

      outsider_identity =
        attach_user_identity(outsider, :apple_provider, "apple-node-outsider")

      revoked_identity_id =
        Absinthe.Relay.Node.to_global_id(:user_identity, revoked_identity.id, LCGQL.Schema)

      outsider_identity_id =
        Absinthe.Relay.Node.to_global_id(:user_identity, outsider_identity.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => revoked_identity_id},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => outsider_identity_id},
                 context: context
               )
    end
  end

  describe "node(user)" do
    test "exposes privacyMode on user nodes" do
      user = user_fixture(privacy_mode: :public)
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          ... on User {
            privacyMode
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"privacyMode" => "PUBLIC"}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => user_id})
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
