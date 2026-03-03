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
end
