defmodule LiveCanvasGQL.Social.SocialQueriesTest do
  use LiveCanvas.DataCase

  import LiveCanvas.AccountsFixtures

  alias LiveCanvas.Social

  describe "relationshipState" do
    test "reports blocked when creator blocks viewer" do
      viewer = user_fixture()
      creator = user_fixture()

      {:ok, _follow} = Social.follow_user(viewer, creator)
      {:ok, _block} = Social.block_user(creator, viewer)

      query = """
      query($viewerId: ID!, $creatorId: ID!) {
        relationshipState(viewerId: $viewerId, creatorId: $creatorId)
      }
      """

      assert {:ok, %{data: %{"relationshipState" => "BLOCKED"}}} =
               Absinthe.run(query, LiveCanvasGQL.Schema,
                 variables: %{"viewerId" => viewer.id, "creatorId" => creator.id}
               )
    end
  end
end
