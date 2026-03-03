defmodule LiveCanvasGQL.Social.SocialMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  describe "followUser" do
    test "returns requested for a private account" do
      follower = user_fixture()
      followed = user_fixture(privacy_mode: :private)

      mutation = """
      mutation($followerId: ID!, $followedId: ID!) {
        followUser(input: {followerId: $followerId, followedId: $followedId}) {
          state
        }
      }
      """

      assert {:ok, %{data: %{"followUser" => %{"state" => "REQUESTED"}}}} =
               Absinthe.run(mutation, LiveCanvasGQL.Schema,
                 variables: %{"followerId" => follower.id, "followedId" => followed.id}
               )
    end
  end
end
