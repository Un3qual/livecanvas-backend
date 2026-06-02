defmodule LCGQL.Feed.FeedQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Content, Live, Social}
  alias LCTransport.LiveSessionTopics

  describe "homeFeed" do
    test "excludes visible story posts from the timeline connection" do
      viewer = user_fixture()
      creator = user_fixture(privacy_mode: :public)

      {:ok, _story_post} =
        Content.create_post(creator, %{kind: :story, body_text: "story", visibility: :public})

      {:ok, standard_post} =
        Content.create_post(creator, %{
          kind: :standard,
          body_text: "timeline",
          visibility: :public
        })

      query = """
      query($first: Int!) {
        homeFeed(first: $first) {
          edges {
            node {
              id
              bodyText
              kind
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}
      standard_post_id = Absinthe.Relay.Node.to_global_id(:post, standard_post.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "homeFeed" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^standard_post_id,
                          "bodyText" => "timeline",
                          "kind" => "STANDARD"
                        }
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

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

    test "batches repeated author lookups when homeFeed requests post authors" do
      viewer = user_fixture()
      creators = for _ <- 1..3, do: user_fixture(privacy_mode: :public)

      for {creator, index} <- Enum.with_index(creators, 1) do
        assert {:ok, _post} =
                 Content.create_post(creator, %{
                   kind: :standard,
                   body_text: "batched-author-#{index}",
                   visibility: :public
                 })
      end

      query = """
      query($first: Int!) {
        homeFeed(first: $first) {
          edges {
            node {
              id
              author {
                id
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {result, queries} =
        capture_repo_queries(fn ->
          Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
        end)

      assert {:ok, %{data: %{"homeFeed" => %{"edges" => edges}}}} = result
      assert length(edges) == 3

      assert count_table_queries(queries, "users") <= 2
    end
  end

  describe "storyFeed" do
    test "returns active visible stories through a Relay connection" do
      viewer = user_fixture()
      followed_creator = user_fixture()
      public_creator = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, followed_creator)

      {:ok, followed_story} =
        Content.create_post(followed_creator, %{kind: :story, body_text: "followers story"})

      {:ok, public_story} =
        Content.create_post(public_creator, %{
          kind: :story,
          body_text: "public story",
          visibility: :public
        })

      {:ok, _timeline_post} =
        Content.create_post(public_creator, %{
          kind: :standard,
          body_text: "timeline post",
          visibility: :public
        })

      now = DateTime.utc_now()
      followed_inserted_at = DateTime.add(now, -180, :second)
      public_inserted_at = DateTime.add(now, -60, :second)
      active_expires_at = DateTime.add(now, 60, :second)

      {1, _rows} =
        Repo.update_all(
          from(post in LCSchemas.Content.Post, where: post.id == ^followed_story.id),
          set: [
            inserted_at: followed_inserted_at,
            updated_at: followed_inserted_at,
            expires_at: active_expires_at
          ]
        )

      {1, _rows} =
        Repo.update_all(from(post in LCSchemas.Content.Post, where: post.id == ^public_story.id),
          set: [
            inserted_at: public_inserted_at,
            updated_at: public_inserted_at,
            expires_at: active_expires_at
          ]
        )

      query = """
      query($first: Int!) {
        storyFeed(first: $first) {
          edges {
            node {
              id
              kind
              bodyText
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}
      followed_story_id = Absinthe.Relay.Node.to_global_id(:post, followed_story.id, LCGQL.Schema)
      public_story_id = Absinthe.Relay.Node.to_global_id(:post, public_story.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "storyFeed" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^public_story_id,
                          "kind" => "STORY",
                          "bodyText" => "public story"
                        }
                      },
                      %{
                        "node" => %{
                          "id" => ^followed_story_id,
                          "kind" => "STORY",
                          "bodyText" => "followers story"
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
    test "returns the documented live-session fields for visible sessions" do
      viewer = user_fixture()
      followed_host = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, followed_host)

      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})
      {:ok, followed_session} = Live.mark_session_live(followed_session)

      {:ok, public_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, public_session} = Live.mark_session_live(public_session)

      query = """
      query($first: Int!) {
        liveNow(first: $first) {
          edges {
            node {
              id
              status
              visibility
              insertedAt
              startedAt
              endedAt
              host {
                id
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      followed_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, followed_session.id, LCGQL.Schema)

      public_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, public_session.id, LCGQL.Schema)

      followed_host_id = Absinthe.Relay.Node.to_global_id(:user, followed_host.id, LCGQL.Schema)
      public_host_id = Absinthe.Relay.Node.to_global_id(:user, public_host.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "liveNow" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^public_session_id,
                          "status" => "LIVE",
                          "visibility" => "PUBLIC",
                          "insertedAt" => public_inserted_at,
                          "startedAt" => public_started_at,
                          "endedAt" => nil,
                          "host" => %{"id" => ^public_host_id}
                        }
                      },
                      %{
                        "node" => %{
                          "id" => ^followed_session_id,
                          "status" => "LIVE",
                          "visibility" => "FOLLOWERS",
                          "insertedAt" => followed_inserted_at,
                          "startedAt" => followed_started_at,
                          "endedAt" => nil,
                          "host" => %{"id" => ^followed_host_id}
                        }
                      }
                    ],
                    "pageInfo" => %{"hasNextPage" => false}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)

      assert {:ok, _, 0} = DateTime.from_iso8601(public_inserted_at)
      assert {:ok, _, 0} = DateTime.from_iso8601(public_started_at)
      assert {:ok, _, 0} = DateTime.from_iso8601(followed_inserted_at)
      assert {:ok, _, 0} = DateTime.from_iso8601(followed_started_at)
    end

    test "live sessions expose an opaque channel topic for active sessions" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(session)

      query = """
      query LiveNowWithChannelTopic {
        liveNow(first: 10) {
          edges {
            node {
              id
              channelTopic
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "liveNow" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => _relay_id,
                          "channelTopic" => channel_topic
                        }
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 context: %{current_scope: Accounts.scope_for_user(viewer)}
               )

      assert channel_topic == LiveSessionTopics.live_session_topic(live_session.id)
    end

    test "liveNow does not expose channel topics for non-visible followers-only sessions" do
      host = user_fixture()
      outsider = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, _live_session} = Live.mark_session_live(session)

      query = """
      query HiddenLiveNowWithChannelTopic {
        liveNow(first: 10) {
          edges {
            node {
              id
              channelTopic
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"liveNow" => %{"edges" => []}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 context: %{current_scope: Accounts.scope_for_user(outsider)}
               )
    end

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

    test "does not exclude live sessions from hosts who muted the current viewer" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(host, viewer)

      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _live_session} = Live.mark_session_live(live_session)

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

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "liveNow" => %{
                    "edges" => [%{"node" => %{"id" => ^live_session_id, "status" => "LIVE"}}]
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

    test "batches repeated host lookups when liveNow requests hosts" do
      viewer = user_fixture()

      for _ <- 1..3 do
        host = user_fixture(privacy_mode: :public)
        {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
        assert {:ok, _session} = Live.mark_session_live(live_session)
      end

      query = """
      query($first: Int!) {
        liveNow(first: $first) {
          edges {
            node {
              id
              host {
                id
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {result, queries} =
        capture_repo_queries(fn ->
          Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
        end)

      assert {:ok, %{data: %{"liveNow" => %{"edges" => edges}}}} = result
      assert length(edges) == 3

      assert count_table_queries(queries, "users") <= 2
    end
  end

  describe "replayFeed" do
    test "returns visible replay sessions with host and recording metadata" do
      viewer = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      followed_host = user_fixture()
      _follow = accepted_follow_fixture(viewer, followed_host)

      {:ok, public_asset} =
        Content.create_media_asset(public_host, %{
          storage_key: "uploads/users/#{public_host.id}/replay-feed-public.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, public_session} = Live.start_live_session(public_host, %{visibility: :public})

      {:ok, ended_public_session} =
        Live.end_live_session(public_session, %{recording_media_asset_id: public_asset.id})

      {:ok, followed_asset} =
        Content.create_media_asset(followed_host, %{
          storage_key: "uploads/users/#{followed_host.id}/replay-feed-followers.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})

      {:ok, ended_followed_session} =
        Live.end_live_session(followed_session, %{recording_media_asset_id: followed_asset.id})

      query = """
      query($first: Int!) {
        replayFeed(first: $first) {
          edges {
            node {
              id
              status
              host {
                id
              }
              recordingMediaAsset {
                id
                processingState
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      ended_public_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_public_session.id, LCGQL.Schema)

      ended_followed_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_followed_session.id, LCGQL.Schema)

      public_host_id = Absinthe.Relay.Node.to_global_id(:user, public_host.id, LCGQL.Schema)
      followed_host_id = Absinthe.Relay.Node.to_global_id(:user, followed_host.id, LCGQL.Schema)

      public_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, public_asset.id, LCGQL.Schema)

      followed_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, followed_asset.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "replayFeed" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^ended_followed_session_id,
                          "status" => "ENDED",
                          "host" => %{"id" => ^followed_host_id},
                          "recordingMediaAsset" => %{
                            "id" => ^followed_asset_id,
                            "processingState" => "PROCESSED"
                          }
                        }
                      },
                      %{
                        "node" => %{
                          "id" => ^ended_public_session_id,
                          "status" => "ENDED",
                          "host" => %{"id" => ^public_host_id},
                          "recordingMediaAsset" => %{
                            "id" => ^public_asset_id,
                            "processingState" => "PROCESSED"
                          }
                        }
                      }
                    ],
                    "pageInfo" => %{"hasNextPage" => false}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

    test "batches repeated recording lookups for replayFeed edges" do
      viewer = user_fixture()

      for index <- 1..2 do
        host = user_fixture(privacy_mode: :public)

        {:ok, recording_asset} =
          Content.create_media_asset(host, %{
            storage_key: "uploads/users/#{host.id}/replay-batch-#{index}.mp4",
            mime_type: "video/mp4",
            processing_state: :processed
          })

        {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

        assert {:ok, _ended_session} =
                 Live.end_live_session(live_session, %{
                   recording_media_asset_id: recording_asset.id
                 })
      end

      query = """
      query($first: Int!) {
        replayFeed(first: $first) {
          edges {
            node {
              id
              recordingMediaAsset {
                id
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {result, queries} =
        capture_repo_queries(fn ->
          Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
        end)

      assert {:ok, %{data: %{"replayFeed" => %{"edges" => edges}}}} = result
      assert length(edges) == 2

      assert count_table_queries(queries, "media_assets") <= 1
    end

    test "shows follower-only replay sessions only to accepted followers" do
      viewer = user_fixture()
      outsider = user_fixture()
      follower_only_host = user_fixture()
      _follow = accepted_follow_fixture(viewer, follower_only_host)

      {:ok, recording_asset} =
        Content.create_media_asset(follower_only_host, %{
          storage_key: "uploads/users/#{follower_only_host.id}/replay-feed-private.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, live_session} = Live.start_live_session(follower_only_host, %{visibility: :followers})

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      query = """
      query($first: Int!) {
        replayFeed(first: $first) {
          edges {
            node {
              id
            }
          }
        }
      }
      """

      visible_context = %{current_scope: Accounts.scope_for_user(viewer)}
      hidden_context = %{current_scope: Accounts.scope_for_user(outsider)}

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "replayFeed" => %{
                    "edges" => [%{"node" => %{"id" => ^live_session_id}}]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"first" => 10},
                 context: visible_context
               )

      assert {:ok, %{data: %{"replayFeed" => %{"edges" => []}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"first" => 10},
                 context: hidden_context
               )
    end

    test "keeps replay mute visibility directional" do
      viewer = user_fixture()
      muted_host = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(viewer, muted_host)
      _reverse_mute = mute_fixture(reverse_muter, viewer)

      {:ok, muted_asset} =
        Content.create_media_asset(muted_host, %{
          storage_key: "uploads/users/#{muted_host.id}/replay-feed-muted.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})

      {:ok, _ended_muted_session} =
        Live.end_live_session(muted_session, %{recording_media_asset_id: muted_asset.id})

      {:ok, reverse_muted_asset} =
        Content.create_media_asset(reverse_muter, %{
          storage_key: "uploads/users/#{reverse_muter.id}/replay-feed-reverse-muted.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, reverse_muted_session} =
        Live.start_live_session(reverse_muter, %{visibility: :public})

      {:ok, ended_reverse_muted_session} =
        Live.end_live_session(reverse_muted_session, %{
          recording_media_asset_id: reverse_muted_asset.id
        })

      query = """
      query($first: Int!) {
        replayFeed(first: $first) {
          edges {
            node {
              id
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      ended_reverse_muted_session_id =
        Absinthe.Relay.Node.to_global_id(
          :live_session,
          ended_reverse_muted_session.id,
          LCGQL.Schema
        )

      assert {:ok,
              %{
                data: %{
                  "replayFeed" => %{
                    "edges" => [%{"node" => %{"id" => ^ended_reverse_muted_session_id}}]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end

    test "returns an empty replay connection without viewer scope and excludes unrecorded sessions" do
      host = user_fixture(privacy_mode: :public)

      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _ended_session} = Live.end_live_session(live_session)

      query = """
      query($first: Int!) {
        replayFeed(first: $first) {
          edges {
            node {
              id
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"replayFeed" => %{"edges" => []}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10})
    end

    test "returns nil recordingMediaAsset when the linked recording is no longer durable" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)

      {:ok, recording_asset} =
        Content.create_media_asset(host, %{
          storage_key: "uploads/users/#{host.id}/replay-feed-failed.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      {1, nil} =
        Repo.update_all(
          from(media_asset in LCSchemas.Content.MediaAsset,
            where: media_asset.id == ^recording_asset.id
          ),
          set: [processing_state: :failed]
        )

      query = """
      query($first: Int!) {
        replayFeed(first: $first) {
          edges {
            node {
              id
              recordingMediaAsset {
                id
              }
            }
          }
        }
      }
      """

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      ended_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "replayFeed" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^ended_session_id,
                          "recordingMediaAsset" => nil
                        }
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 10}, context: context)
    end
  end
end
