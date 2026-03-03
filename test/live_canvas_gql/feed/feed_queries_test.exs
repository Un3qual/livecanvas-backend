defmodule LCGQL.Feed.FeedQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Content, Live, Social}

  describe "homeFeed" do
    test "excludes posts from suspended creators" do
      viewer = user_fixture()
      suspended_creator = user_fixture(privacy_mode: :public)
      visible_creator = user_fixture(privacy_mode: :public)
      assert {:ok, _suspended_creator} = Accounts.suspend_user(suspended_creator)

      {:ok, _suspended_post} =
        Content.create_post(suspended_creator, %{
          kind: :standard,
          body_text: "suspended-hidden",
          visibility: :public
        })

      {:ok, visible_post} =
        Content.create_post(visible_creator, %{
          kind: :standard,
          body_text: "visible",
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
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}
      visible_post_id = Absinthe.Relay.Node.to_global_id(:post, visible_post.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "homeFeed" => %{
                    "edges" => [
                      %{"node" => %{"id" => ^visible_post_id, "bodyText" => "visible"}}
                    ]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

    test "excludes posts from creators muted by the current viewer" do
      viewer = user_fixture()
      muted_creator = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)
      _viewer_mute = mute_fixture(viewer, muted_creator)
      _reverse_mute = mute_fixture(reverse_muter, viewer)

      {:ok, _muted_post} =
        Content.create_post(muted_creator, %{
          kind: :standard,
          body_text: "muted",
          visibility: :public
        })

      {:ok, visible_post} =
        Content.create_post(reverse_muter, %{
          kind: :standard,
          body_text: "reverse-mute-visible",
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
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      visible_post_id = Absinthe.Relay.Node.to_global_id(:post, visible_post.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "homeFeed" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^visible_post_id,
                          "bodyText" => "reverse-mute-visible"
                        }
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

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
    test "excludes sessions hosted by suspended users" do
      viewer = user_fixture()
      suspended_host = user_fixture(privacy_mode: :public)
      visible_host = user_fixture(privacy_mode: :public)

      {:ok, suspended_session} = Live.start_live_session(suspended_host, %{visibility: :public})
      {:ok, _suspended_live} = Live.mark_session_live(suspended_session)
      assert {:ok, _suspended_host} = Accounts.suspend_user(suspended_host)

      {:ok, visible_session} = Live.start_live_session(visible_host, %{visibility: :public})
      {:ok, _visible_live} = Live.mark_session_live(visible_session)

      query = """
      query($first: Int!) {
        liveNow(first: $first) {
          edges {
            node {
              id
              status
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      visible_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, visible_session.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "liveNow" => %{
                    "edges" => [%{"node" => %{"id" => ^visible_session_id, "status" => "LIVE"}}]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

    test "excludes live sessions from hosts muted by the current viewer" do
      viewer = user_fixture()
      muted_host = user_fixture(privacy_mode: :public)
      visible_host = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(viewer, muted_host)

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})
      {:ok, _muted_live} = Live.mark_session_live(muted_session)

      {:ok, visible_session} = Live.start_live_session(visible_host, %{visibility: :public})
      {:ok, _visible_live} = Live.mark_session_live(visible_session)

      query = """
      query($first: Int!) {
        liveNow(first: $first) {
          edges {
            node {
              id
              status
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      visible_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, visible_session.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "liveNow" => %{
                    "edges" => [%{"node" => %{"id" => ^visible_session_id, "status" => "LIVE"}}]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

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
