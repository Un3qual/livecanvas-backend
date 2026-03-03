defmodule LCGQL.Feed.FeedQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Content, Live, Social}

  describe "homeFeed" do
    test "returns only posts visible to the current viewer" do
      viewer = user_fixture()
      followed_creator = user_fixture()
      public_creator = user_fixture(privacy_mode: :public)
      blocked_creator = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, followed_creator)
      {:ok, _block} = Social.block_user(blocked_creator, viewer)

      {:ok, followed_post} =
        Content.create_post(followed_creator, %{kind: :standard, body_text: "followers-visible"})

      {:ok, public_post} =
        Content.create_post(public_creator, %{
          kind: :standard,
          body_text: "public",
          visibility: :public
        })

      {:ok, _blocked_post} =
        Content.create_post(blocked_creator, %{
          kind: :standard,
          body_text: "blocked",
          visibility: :public
        })

      query = """
      query($first: Int!) {
        homeFeed(first: $first) {
          edges {
            node {
              id
              bodyText
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      public_post_id = Absinthe.Relay.Node.to_global_id(:post, public_post.id, LCGQL.Schema)
      followed_post_id = Absinthe.Relay.Node.to_global_id(:post, followed_post.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "homeFeed" => %{
                    "edges" => [
                      %{"node" => %{"id" => ^public_post_id, "bodyText" => "public"}},
                      %{
                        "node" => %{
                          "id" => ^followed_post_id,
                          "bodyText" => "followers-visible"
                        }
                      }
                    ],
                    "pageInfo" => %{"hasNextPage" => false}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end
  end

  describe "liveNow" do
    test "returns only currently-live sessions visible to the current viewer" do
      viewer = user_fixture()
      followed_host = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      blocked_host = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, followed_host)
      {:ok, _block} = Social.block_user(blocked_host, viewer)

      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})
      {:ok, _followed_live} = Live.mark_session_live(followed_session)

      {:ok, public_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, _public_live} = Live.mark_session_live(public_session)

      {:ok, blocked_session} = Live.start_live_session(blocked_host, %{visibility: :public})
      {:ok, _blocked_live} = Live.mark_session_live(blocked_session)

      {:ok, _starting_session} = Live.start_live_session(public_host, %{visibility: :public})

      query = """
      query($first: Int!) {
        liveNow(first: $first) {
          edges {
            node {
              id
              status
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      public_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, public_session.id, LCGQL.Schema)

      followed_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, followed_session.id, LCGQL.Schema)

      _blocked_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, blocked_session.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "liveNow" => %{
                    "edges" => [
                      %{"node" => %{"id" => ^public_session_id, "status" => "LIVE"}},
                      %{"node" => %{"id" => ^followed_session_id, "status" => "LIVE"}}
                    ],
                    "pageInfo" => %{"hasNextPage" => false}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end
  end
end
