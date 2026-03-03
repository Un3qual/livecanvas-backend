defmodule LC.Integration.FeedVisibilityFlowTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.Content

  test "home feed API only returns posts visible to the authenticated viewer" do
    viewer = user_fixture()
    followed_creator = user_fixture()
    public_creator = user_fixture(privacy_mode: :public)
    blocked_creator = user_fixture(privacy_mode: :public)
    muted_creator = user_fixture(privacy_mode: :public)

    _accepted_follow = accepted_follow_fixture(viewer, followed_creator)
    _block = block_fixture(blocked_creator, viewer)
    _mute = mute_fixture(viewer, muted_creator)

    {:ok, followed_post} =
      Content.create_post(followed_creator, %{kind: :standard, body_text: "followers-visible"})

    {:ok, public_post} =
      Content.create_post(public_creator, %{
        kind: :standard,
        body_text: "public-visible",
        visibility: :public
      })

    {:ok, _blocked_post} =
      Content.create_post(blocked_creator, %{
        kind: :standard,
        body_text: "blocked-hidden",
        visibility: :public
      })

    {:ok, _muted_post} =
      Content.create_post(muted_creator, %{
        kind: :standard,
        body_text: "muted-hidden",
        visibility: :public
      })

    public_post_id = Absinthe.Relay.Node.to_global_id(:post, public_post.id, LCGQL.Schema)
    followed_post_id = Absinthe.Relay.Node.to_global_id(:post, followed_post.id, LCGQL.Schema)

    home_feed_query = """
    query($first: Int!) {
      homeFeed(first: $first) {
        edges {
          node {
            id
            bodyText
          }
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "homeFeed" => %{
                  "edges" => [
                    %{"node" => %{"id" => ^public_post_id, "bodyText" => "public-visible"}},
                    %{"node" => %{"id" => ^followed_post_id, "bodyText" => "followers-visible"}}
                  ]
                }
              }
            }} =
             Absinthe.run(home_feed_query, LCGQL.Schema,
               variables: %{"first" => 10},
               context: %{current_scope: authenticated_scope(viewer)}
             )
  end
end
