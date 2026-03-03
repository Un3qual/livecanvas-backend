defmodule LCGQL.Social.SocialMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  describe "followUser" do
    test "returns requested for a private account" do
      follower = user_fixture()
      followed = user_fixture(privacy_mode: :private)
      follower_id = Absinthe.Relay.Node.to_global_id(:user, follower.id, LCGQL.Schema)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!, $followedId: ID!) {
        followUser(input: {followerId: $followerId, followedId: $followedId}) {
          follow {
            id
            state
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "followUser" => %{
                    "follow" => %{"id" => follow_id, "state" => "REQUESTED"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => follower_id, "followedId" => followed_id}
               )

      assert is_binary(follow_id)
    end

    test "rejects a raw numeric followerId that is not a relay global id" do
      follower = user_fixture()
      followed = user_fixture(privacy_mode: :private)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!, $followedId: ID!) {
        followUser(input: {followerId: $followerId, followedId: $followedId}) {
          follow {
            id
            state
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "followUser" => %{
                    "follow" => nil,
                    "errors" => [%{"field" => "followerId", "message" => message} | _rest]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => "#{follower.id}", "followedId" => followed_id}
               )

      assert message =~ "invalid_id"
    end
  end

  describe "blockUser" do
    test "returns successful true with no errors when block is persisted" do
      blocker = user_fixture()
      blocked = user_fixture()
      blocker_id = Absinthe.Relay.Node.to_global_id(:user, blocker.id, LCGQL.Schema)
      blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

      mutation = """
      mutation($blockerId: ID!, $blockedId: ID!) {
        blockUser(input: {blockerId: $blockerId, blockedId: $blockedId}) {
          successful
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "blockUser" => %{
                    "successful" => true,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"blockerId" => blocker_id, "blockedId" => blocked_id}
               )
    end
  end
end
