defmodule LCGQL.Social.SocialQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Social}

  describe "relationshipState" do
    test "reports blocked for the authenticated viewer" do
      viewer = user_fixture()
      creator = user_fixture()
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {:ok, _follow} = Social.follow_user(viewer, creator)
      {:ok, _block} = Social.block_user(creator, viewer)

      query = """
      query($creatorId: ID!) {
        relationshipState(creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"relationshipState" => "BLOCKED"}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"creatorId" => creator_id},
                 context: context
               )
    end

    test "returns NONE without an authenticated viewer" do
      creator = user_fixture()
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)

      query = """
      query($creatorId: ID!) {
        relationshipState(creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"relationshipState" => "NONE"}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"creatorId" => creator_id})
    end

    test "returns NONE for an invalid creator id" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      query = """
      query($creatorId: ID!) {
        relationshipState(creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"relationshipState" => "NONE"}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"creatorId" => "123"},
                 context: context
               )
    end
  end

  describe "isMuted" do
    test "returns true when the authenticated viewer has muted creator" do
      viewer = user_fixture()
      creator = user_fixture()
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {:ok, _mute} = Social.mute_user(viewer, creator)

      query = """
      query($creatorId: ID!) {
        isMuted(creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"isMuted" => true}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"creatorId" => creator_id},
                 context: context
               )
    end

    test "returns false without an authenticated viewer" do
      creator = user_fixture()
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)

      query = """
      query($creatorId: ID!) {
        isMuted(creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"isMuted" => false}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"creatorId" => creator_id})
    end

    test "returns false for an invalid creator id" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      query = """
      query($creatorId: ID!) {
        isMuted(creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"isMuted" => false}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"creatorId" => "123"},
                 context: context
               )
    end
  end

  describe "user relationship connections" do
    test "node.user.followers returns relay edges and pageInfo" do
      creator = user_fixture(privacy_mode: :public)
      follower_1 = user_fixture()
      follower_2 = user_fixture()
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)

      assert {:ok, _follow} = Social.follow_user(follower_1, creator)
      assert {:ok, _follow} = Social.follow_user(follower_2, creator)

      query = """
      query($id: ID!, $first: Int!, $after: String) {
        node(id: $id) {
          ... on User {
            followers(first: $first, after: $after) {
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
      }
      """

      assert {:ok, %{data: %{"node" => %{"followers" => first_page}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => creator_id, "first" => 1})

      assert [%{"cursor" => first_cursor, "node" => %{"id" => first_id}}] = first_page["edges"]
      assert is_binary(first_cursor)
      assert is_binary(first_id)
      assert %{"hasNextPage" => true, "endCursor" => end_cursor} = first_page["pageInfo"]
      assert is_binary(end_cursor)

      assert {:ok, %{data: %{"node" => %{"followers" => second_page}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => creator_id, "first" => 1, "after" => end_cursor}
               )

      assert [%{"cursor" => second_cursor, "node" => %{"id" => second_id}}] = second_page["edges"]
      assert is_binary(second_cursor)
      assert is_binary(second_id)
      assert first_id != second_id
      assert second_page["pageInfo"]["hasNextPage"] == false
    end

    test "node.user.following returns relay edges and pageInfo" do
      follower = user_fixture(privacy_mode: :public)
      creator_1 = user_fixture(privacy_mode: :public)
      creator_2 = user_fixture(privacy_mode: :public)
      follower_id = Absinthe.Relay.Node.to_global_id(:user, follower.id, LCGQL.Schema)

      assert {:ok, _follow} = Social.follow_user(follower, creator_1)
      assert {:ok, _follow} = Social.follow_user(follower, creator_2)

      query = """
      query($id: ID!, $first: Int!, $after: String) {
        node(id: $id) {
          ... on User {
            following(first: $first, after: $after) {
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
      }
      """

      assert {:ok, %{data: %{"node" => %{"following" => first_page}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => follower_id, "first" => 1})

      assert [%{"cursor" => first_cursor, "node" => %{"id" => first_id}}] = first_page["edges"]
      assert is_binary(first_cursor)
      assert is_binary(first_id)
      assert %{"hasNextPage" => true, "endCursor" => end_cursor} = first_page["pageInfo"]
      assert is_binary(end_cursor)

      assert {:ok, %{data: %{"node" => %{"following" => second_page}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => follower_id, "first" => 1, "after" => end_cursor}
               )

      assert [%{"cursor" => second_cursor, "node" => %{"id" => second_id}}] = second_page["edges"]
      assert is_binary(second_cursor)
      assert is_binary(second_id)
      assert first_id != second_id
      assert second_page["pageInfo"]["hasNextPage"] == false
    end
  end

  describe "viewerPendingFollowRequests" do
    test "returns a viewer-scoped relay connection of pending follow requests" do
      viewer = user_fixture(privacy_mode: :private)
      follower_1 = user_fixture()
      follower_2 = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      follower_1_id = Absinthe.Relay.Node.to_global_id(:user, follower_1.id, LCGQL.Schema)
      follower_2_id = Absinthe.Relay.Node.to_global_id(:user, follower_2.id, LCGQL.Schema)

      assert {:ok, follow_1} = Social.follow_user(follower_1, viewer)
      assert {:ok, follow_2} = Social.follow_user(follower_2, viewer)

      follow_request_1_id =
        Absinthe.Relay.Node.to_global_id(:follow_request, follow_1.id, LCGQL.Schema)

      follow_request_2_id =
        Absinthe.Relay.Node.to_global_id(:follow_request, follow_2.id, LCGQL.Schema)

      query = """
      query($first: Int!) {
        viewerPendingFollowRequests(first: $first) {
          edges {
            node {
              id
              state
              requestedAt
              follower {
                id
              }
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "viewerPendingFollowRequests" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^follow_request_1_id,
                          "state" => "REQUESTED",
                          "requestedAt" => requested_at_1,
                          "follower" => %{"id" => ^follower_1_id}
                        }
                      },
                      %{
                        "node" => %{
                          "id" => ^follow_request_2_id,
                          "state" => "REQUESTED",
                          "requestedAt" => requested_at_2,
                          "follower" => %{"id" => ^follower_2_id}
                        }
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)

      assert is_binary(requested_at_1)
      assert is_binary(requested_at_2)
    end

    test "returns an empty connection without a viewer scope" do
      query = """
      query($first: Int!) {
        viewerPendingFollowRequests(first: $first) {
          edges {
            node {
              id
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"viewerPendingFollowRequests" => %{"edges" => []}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10})
    end
  end

  describe "privacy-aware relationship connections" do
    test "hides private-account followers from unauthenticated viewers and outsiders" do
      private_user = user_fixture(privacy_mode: :private)
      accepted_follower = user_fixture()
      outsider = user_fixture()
      private_user_id = Absinthe.Relay.Node.to_global_id(:user, private_user.id, LCGQL.Schema)
      outsider_context = %{current_scope: Accounts.scope_for_user(outsider)}

      assert {:ok, follow} = Social.follow_user(accepted_follower, private_user)
      assert {:ok, _accepted_follow} = Social.accept_follow_request(follow, private_user)

      query = """
      query($id: ID!, $first: Int!) {
        node(id: $id) {
          ... on User {
            followers(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"followers" => %{"edges" => []}}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => private_user_id, "first" => 10}
               )

      assert {:ok, %{data: %{"node" => %{"followers" => %{"edges" => []}}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => private_user_id, "first" => 10},
                 context: outsider_context
               )
    end

    test "allows owners and accepted followers to see private-account relationship connections" do
      private_user = user_fixture(privacy_mode: :private)
      accepted_follower = user_fixture()
      followed_1 = user_fixture(privacy_mode: :public)
      followed_2 = user_fixture(privacy_mode: :public)
      private_user_id = Absinthe.Relay.Node.to_global_id(:user, private_user.id, LCGQL.Schema)
      accepted_follower_context = %{current_scope: Accounts.scope_for_user(accepted_follower)}
      owner_context = %{current_scope: Accounts.scope_for_user(private_user)}

      assert {:ok, pending_follow} = Social.follow_user(accepted_follower, private_user)
      assert {:ok, _accepted_follow} = Social.accept_follow_request(pending_follow, private_user)
      assert {:ok, _followed_1} = Social.follow_user(private_user, followed_1)
      assert {:ok, _followed_2} = Social.follow_user(private_user, followed_2)

      query = """
      query($id: ID!, $first: Int!) {
        node(id: $id) {
          ... on User {
            followers(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
            following(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "followers" => %{"edges" => [%{"node" => %{"id" => _follower_id}}]},
                    "following" => %{
                      "edges" => [
                        %{"node" => %{"id" => _following_id_1}},
                        %{"node" => %{"id" => _following_id_2}}
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => private_user_id, "first" => 10},
                 context: accepted_follower_context
               )

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "followers" => %{"edges" => [%{"node" => %{"id" => _owner_follower_id}}]},
                    "following" => %{
                      "edges" => [
                        %{"node" => %{"id" => _owner_following_id_1}},
                        %{"node" => %{"id" => _owner_following_id_2}}
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => private_user_id, "first" => 10},
                 context: owner_context
               )
    end
  end
end
