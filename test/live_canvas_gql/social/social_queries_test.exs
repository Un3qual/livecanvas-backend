defmodule LCGQL.Social.SocialQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Social

  describe "relationshipState" do
    test "reports blocked when creator blocks viewer" do
      viewer = user_fixture()
      creator = user_fixture()
      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)

      {:ok, _follow} = Social.follow_user(viewer, creator)
      {:ok, _block} = Social.block_user(creator, viewer)

      query = """
      query($viewerId: ID!, $creatorId: ID!) {
        relationshipState(viewerId: $viewerId, creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"relationshipState" => "BLOCKED"}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"viewerId" => viewer_id, "creatorId" => creator_id}
               )
    end
  end

  describe "isMuted" do
    test "returns true when viewer has muted creator" do
      viewer = user_fixture()
      creator = user_fixture()
      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
      creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)

      {:ok, _mute} = Social.mute_user(viewer, creator)

      query = """
      query($viewerId: ID!, $creatorId: ID!) {
        isMuted(viewerId: $viewerId, creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"isMuted" => true}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"viewerId" => viewer_id, "creatorId" => creator_id}
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
      follower = user_fixture()
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
end
