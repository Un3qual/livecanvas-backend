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
          state
        }
      }
      """

      assert {:ok, %{data: %{"followUser" => %{"state" => "REQUESTED"}}}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => follower_id, "followedId" => followed_id}
               )
    end

    test "rejects a raw numeric followerId that is not a relay global id" do
      follower = user_fixture()
      followed = user_fixture(privacy_mode: :private)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!, $followedId: ID!) {
        followUser(input: {followerId: $followerId, followedId: $followedId}) {
          state
        }
      }
      """

      assert {:ok, %{data: nil, errors: [first_error | _rest]}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => "#{follower.id}", "followedId" => followed_id}
               )

      assert first_error.message =~ "invalid_id"
    end
  end
end
