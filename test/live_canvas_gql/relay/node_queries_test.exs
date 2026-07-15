defmodule LCGQL.Relay.NodeQueriesTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.ContentFixtures, only: [media_asset_fixture: 2]
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Content, Live, Social}
  alias LCSchemas.Content.Post
  alias LCSchemas.Live.LiveSession

  defmodule CaptureExecutionContextPhase do
    use Absinthe.Phase

    @impl true
    def run(blueprint, opts) do
      send(opts[:test_pid], {:execution_context, blueprint.execution.context})
      {:ok, blueprint}
    end
  end

  describe "node" do
    test "returns nil for private user email without viewer ownership" do
      user = user_fixture()
      global_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on User {
            email
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"id" => ^global_id, "email" => nil}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => global_id})
    end

    test "returns private user email through node refetch for the owning viewer" do
      user = user_fixture()
      global_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(user)}

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on User {
            email
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"id" => ^global_id, "email" => user_email}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => global_id},
                 context: context
               )

      assert user_email == user.email
    end

    test "returns public profile identity through an anonymous node refetch" do
      user = user_fixture(privacy_mode: :public)

      assert {:ok, user} =
               Accounts.update_user_profile_identity(user, %{
                 username: "canvas_creator",
                 display_name: "Canvas Creator"
               })

      global_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on User {
            username
            displayName
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^global_id,
                    "username" => "canvas_creator",
                    "displayName" => "Canvas Creator"
                  }
                }
              }} = Absinthe.run(query, LCGQL.Schema, variables: %{"id" => global_id})
    end

    test "does not refetch suspended users by Relay ID" do
      suspended_user = user_fixture(privacy_mode: :public)
      viewer = user_fixture()

      assert {:ok, suspended_user} =
               Accounts.update_user_profile_identity(suspended_user, %{
                 username: "suspended_creator",
                 display_name: "Suspended Creator"
               })

      assert {:ok, _suspended_user} = Accounts.suspend_user(suspended_user)

      global_id =
        Absinthe.Relay.Node.to_global_id(:user, suspended_user.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on User {
            username
            displayName
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => global_id})

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => global_id},
                 context: %{current_scope: Accounts.scope_for_user(viewer)}
               )
    end

    test "returns nil when the target user blocked the authenticated viewer" do
      viewer = user_fixture()
      target = user_fixture(privacy_mode: :public)
      target_id = Absinthe.Relay.Node.to_global_id(:user, target.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, _block} = Social.block_user(target, viewer)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on User {
            privacyMode
            username
            displayName
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => target_id},
                 context: context
               )
    end

    test "returns the target when the authenticated viewer created the block" do
      viewer = user_fixture()
      target = user_fixture(privacy_mode: :public)
      target_id = Absinthe.Relay.Node.to_global_id(:user, target.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, _block} = Social.block_user(viewer, target)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on User {
            privacyMode
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"id" => ^target_id, "privacyMode" => "PUBLIC"}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => target_id},
                 context: context
               )
    end

    test "refetches visible profile posts, stories, current live session, and replays from a user relay id" do
      owner = user_fixture()
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      _follow = accepted_follow_fixture(viewer, owner)

      {:ok, profile_post} =
        Content.create_post(owner, %{kind: :standard, body_text: "node profile post"})

      {:ok, profile_story} =
        Content.create_post(owner, %{kind: :story, body_text: "node profile story"})

      {:ok, current_live_session} = Live.start_live_session(owner, %{visibility: :followers})
      {:ok, current_live_session} = Live.mark_session_live(current_live_session)

      replay_asset =
        media_asset_fixture(owner, %{
          storage_key: "uploads/users/#{owner.id}/node-profile-replay.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, replay_session} = Live.start_live_session(owner, %{visibility: :followers})

      {:ok, replay_session} =
        Live.end_live_session(replay_session, %{recording_media_asset_id: replay_asset.id})

      user_id = Absinthe.Relay.Node.to_global_id(:user, owner.id, LCGQL.Schema)
      profile_post_id = Absinthe.Relay.Node.to_global_id(:post, profile_post.id, LCGQL.Schema)
      profile_story_id = Absinthe.Relay.Node.to_global_id(:post, profile_story.id, LCGQL.Schema)

      current_live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, current_live_session.id, LCGQL.Schema)

      replay_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, replay_session.id, LCGQL.Schema)

      replay_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, replay_asset.id, LCGQL.Schema)

      query = """
      query($id: ID!, $first: Int!) {
        node(id: $id) {
          id
          ... on User {
            posts(first: $first) {
              edges {
                node {
                  id
                  bodyText
                }
              }
            }
            storyFeed(first: $first) {
              edges {
                node {
                  id
                  bodyText
                }
              }
            }
            currentLiveSession {
              id
              status
            }
            replayFeed(first: $first) {
              edges {
                node {
                  id
                  status
                  recordingMediaAsset {
                    id
                    processingState
                  }
                }
              }
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^user_id,
                    "posts" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^profile_post_id,
                            "bodyText" => "node profile post"
                          }
                        }
                      ]
                    },
                    "storyFeed" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^profile_story_id,
                            "bodyText" => "node profile story"
                          }
                        }
                      ]
                    },
                    "currentLiveSession" => %{
                      "id" => ^current_live_session_id,
                      "status" => "LIVE"
                    },
                    "replayFeed" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^replay_session_id,
                            "status" => "ENDED",
                            "recordingMediaAsset" => %{
                              "id" => ^replay_asset_id,
                              "processingState" => "PROCESSED"
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => user_id, "first" => 10},
                 context: context
               )
    end

    test "paginates visible profile content connections newest-first" do
      owner = user_fixture()
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      _follow = accepted_follow_fixture(viewer, owner)

      {:ok, older_post} =
        Content.create_post(owner, %{kind: :standard, body_text: "older profile post"})

      {:ok, newer_post} =
        Content.create_post(owner, %{kind: :standard, body_text: "newer profile post"})

      {:ok, older_story} =
        Content.create_post(owner, %{kind: :story, body_text: "older active story"})

      {:ok, newer_story} =
        Content.create_post(owner, %{kind: :story, body_text: "newer active story"})

      {:ok, expired_story} =
        Content.create_post(owner, %{kind: :story, body_text: "expired story"})

      older_at = ~U[2026-07-08 10:00:00.000000Z]
      newer_at = ~U[2026-07-08 11:00:00.000000Z]

      for {post, inserted_at} <- [
            {older_post, older_at},
            {newer_post, newer_at},
            {older_story, older_at},
            {newer_story, newer_at}
          ] do
        {1, _rows} =
          Repo.update_all(from(row in Post, where: row.id == ^post.id),
            set: [inserted_at: inserted_at, updated_at: inserted_at]
          )
      end

      {1, _rows} =
        Repo.update_all(from(row in Post, where: row.id == ^expired_story.id),
          set: [expires_at: older_at, inserted_at: newer_at, updated_at: newer_at]
        )

      older_asset =
        media_asset_fixture(owner, %{
          storage_key: "uploads/users/#{owner.id}/older-profile-replay.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      newer_asset =
        media_asset_fixture(owner, %{
          storage_key: "uploads/users/#{owner.id}/newer-profile-replay.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, older_replay} = Live.start_live_session(owner, %{visibility: :followers})

      {:ok, older_replay} =
        Live.end_live_session(older_replay, %{recording_media_asset_id: older_asset.id})

      {:ok, newer_replay} = Live.start_live_session(owner, %{visibility: :followers})

      {:ok, newer_replay} =
        Live.end_live_session(newer_replay, %{recording_media_asset_id: newer_asset.id})

      for {session, ended_at} <- [{older_replay, older_at}, {newer_replay, newer_at}] do
        {1, _rows} =
          Repo.update_all(from(row in LiveSession, where: row.id == ^session.id),
            set: [ended_at: ended_at, updated_at: ended_at]
          )
      end

      query = """
      query(
        $id: ID!
        $postsAfter: String
        $storiesAfter: String
        $replaysAfter: String
      ) {
        node(id: $id) {
          ... on User {
            posts(first: 1, after: $postsAfter) {
              edges { cursor node { id bodyText } }
              pageInfo { endCursor hasNextPage }
            }
            storyFeed(first: 1, after: $storiesAfter) {
              edges { cursor node { id bodyText } }
              pageInfo { endCursor hasNextPage }
            }
            replayFeed(first: 1, after: $replaysAfter) {
              edges { cursor node { id status } }
              pageInfo { endCursor hasNextPage }
            }
          }
        }
      }
      """

      profile_id = Absinthe.Relay.Node.to_global_id(:user, owner.id, LCGQL.Schema)

      assert {:ok, %{data: %{"node" => first_page}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{
                   "id" => profile_id,
                   "postsAfter" => nil,
                   "storiesAfter" => nil,
                   "replaysAfter" => nil
                 },
                 context: context
               )

      assert [%{"node" => %{"bodyText" => "newer profile post"}}] =
               first_page["posts"]["edges"]

      assert [%{"node" => %{"bodyText" => "newer active story"}}] =
               first_page["storyFeed"]["edges"]

      assert [%{"node" => %{"id" => newer_replay_id}}] =
               first_page["replayFeed"]["edges"]

      assert newer_replay_id ==
               Absinthe.Relay.Node.to_global_id(:live_session, newer_replay.id, LCGQL.Schema)

      assert first_page["posts"]["pageInfo"]["hasNextPage"]
      assert first_page["storyFeed"]["pageInfo"]["hasNextPage"]
      assert first_page["replayFeed"]["pageInfo"]["hasNextPage"]

      assert {:ok, %{data: %{"node" => second_page}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{
                   "id" => profile_id,
                   "postsAfter" => first_page["posts"]["pageInfo"]["endCursor"],
                   "storiesAfter" => first_page["storyFeed"]["pageInfo"]["endCursor"],
                   "replaysAfter" => first_page["replayFeed"]["pageInfo"]["endCursor"]
                 },
                 context: context
               )

      assert [%{"node" => %{"bodyText" => "older profile post"}}] =
               second_page["posts"]["edges"]

      assert [%{"node" => %{"bodyText" => "older active story"}}] =
               second_page["storyFeed"]["edges"]

      assert [%{"node" => %{"id" => older_replay_id}}] =
               second_page["replayFeed"]["edges"]

      assert older_replay_id ==
               Absinthe.Relay.Node.to_global_id(:live_session, older_replay.id, LCGQL.Schema)

      refute second_page["posts"]["pageInfo"]["hasNextPage"]
      refute second_page["storyFeed"]["pageInfo"]["hasNextPage"]
      refute second_page["replayFeed"]["pageInfo"]["hasNextPage"]
    end

    test "returns empty profile child fields for unauthorized user node refetches" do
      owner = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}

      {:ok, _profile_post} =
        Content.create_post(owner, %{kind: :standard, body_text: "hidden node profile post"})

      {:ok, _profile_story} =
        Content.create_post(owner, %{kind: :story, body_text: "hidden node profile story"})

      {:ok, current_live_session} = Live.start_live_session(owner, %{visibility: :followers})
      {:ok, _current_live_session} = Live.mark_session_live(current_live_session)

      replay_asset =
        media_asset_fixture(owner, %{
          storage_key: "uploads/users/#{owner.id}/hidden-node-profile-replay.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, replay_session} = Live.start_live_session(owner, %{visibility: :followers})

      {:ok, _replay_session} =
        Live.end_live_session(replay_session, %{recording_media_asset_id: replay_asset.id})

      user_id = Absinthe.Relay.Node.to_global_id(:user, owner.id, LCGQL.Schema)

      query = """
      query($id: ID!, $first: Int!) {
        node(id: $id) {
          id
          ... on User {
            posts(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
            storyFeed(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
            currentLiveSession {
              id
            }
            replayFeed(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^user_id,
                    "posts" => %{"edges" => []},
                    "storyFeed" => %{"edges" => []},
                    "currentLiveSession" => nil,
                    "replayFeed" => %{"edges" => []}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => user_id, "first" => 10},
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^user_id,
                    "posts" => %{"edges" => []},
                    "storyFeed" => %{"edges" => []},
                    "currentLiveSession" => nil,
                    "replayFeed" => %{"edges" => []}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => user_id, "first" => 10})
    end

    test "rejects a raw numeric id that is not a relay global id" do
      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{errors: [first_error | _rest]}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => "123"})

      assert first_error.message =~ "Could not decode ID value"
    end

    test "lets non-positive relay local ids fall through to node lookup queries" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      node_cases = [
        {:user, "users"},
        {:user_identity, "user_identities"},
        {:post, "posts"},
        {:media_asset, "media_assets"},
        {:post_report, "post_reports"},
        {:live_session, "live_sessions"},
        {:follow_request, "follows"},
        {:chat_message_event, "live_session_timeline_event_states"},
        {:data_export_request, "data_export_requests"},
        {:account_deletion_request, "account_deletion_requests"},
        {:contact_match, "user_contact_entries"}
      ]

      for {node_type, table_name} <- node_cases, local_id <- [0, -1] do
        global_id = Absinthe.Relay.Node.to_global_id(node_type, local_id, LCGQL.Schema)

        {result, queries} =
          capture_repo_queries(fn ->
            Absinthe.run(query, LCGQL.Schema,
              variables: %{"id" => global_id},
              context: context
            )
          end)

        assert {:ok, %{data: %{"node" => nil}}} = result
        assert count_table_queries(queries, table_name) > 0
      end
    end

    test "returns nil for follower-only post node lookups without viewer visibility" do
      author = user_fixture()
      outsider = user_fixture()
      outsider_context = %{current_scope: Accounts.scope_for_user(outsider)}

      {:ok, post} =
        Content.create_post(author, %{kind: :standard, body_text: "private node post"})

      post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => post_id},
                 context: outsider_context
               )
    end

    test "refetches a follower-visible post and its loader-backed author from a relay global id" do
      author = user_fixture()
      follower = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(follower)}
      _follow = accepted_follow_fixture(follower, author)

      {:ok, post} =
        Content.create_post(author, %{kind: :standard, body_text: "visible to followers"})

      post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)
      author_id = Absinthe.Relay.Node.to_global_id(:user, author.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on Post {
            bodyText
            author {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^post_id,
                    "bodyText" => "visible to followers",
                    "author" => %{"id" => ^author_id}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => post_id},
                 context: context
               )
    end

    test "returns nil for expired story node lookups even when the relay ID is valid" do
      author = user_fixture()
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {:ok, story_post} =
        Content.create_post(author, %{
          kind: :story,
          body_text: "expired node story",
          visibility: :public
        })

      expired_at = ~U[2026-03-18 17:00:00.000000Z]

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^story_post.id),
          set: [expires_at: expired_at, updated_at: expired_at]
        )

      post_id = Absinthe.Relay.Node.to_global_id(:post, story_post.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => post_id},
                 context: context
               )
    end

    test "refetches a viewer-owned contact match from a relay global id" do
      viewer = user_fixture()
      matched_user = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      {:ok, contact_entry} =
        Accounts.upsert_user_contact_entry(viewer, %{
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Friend Match",
          birthday: "1990-02-15",
          emails: [matched_user.email]
        })

      contact_match_id =
        Absinthe.Relay.Node.to_global_id(:contact_match, contact_entry.id, LCGQL.Schema)

      matched_user_id = Absinthe.Relay.Node.to_global_id(:user, matched_user.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on ContactMatch {
            contactName
            birthday
            matchedUsers {
              id
              email
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^contact_match_id,
                    "contactName" => "Friend Match",
                    "birthday" => "1990-02-15",
                    "matchedUsers" => [%{"id" => ^matched_user_id, "email" => nil}]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => contact_match_id},
                 context: context
               )
    end

    test "omits a blocking user from contact match node refetch" do
      viewer = user_fixture()
      hidden_match = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, _block} = Social.block_user(hidden_match, viewer)

      {:ok, contact_entry} =
        Accounts.upsert_user_contact_entry(viewer, %{
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Hidden Match",
          emails: [hidden_match.email]
        })

      contact_match_id =
        Absinthe.Relay.Node.to_global_id(:contact_match, contact_entry.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          ... on ContactMatch {
            matchedUsers {
              id
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"matchedUsers" => []}}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => contact_match_id},
                 context: context
               )
    end

    test "returns null for contact match node lookups without the owning viewer context" do
      owner = user_fixture()
      other_viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(other_viewer)}

      {:ok, contact_entry} =
        Accounts.upsert_user_contact_entry(owner, %{
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Private Match",
          emails: [other_viewer.email]
        })

      contact_match_id =
        Absinthe.Relay.Node.to_global_id(:contact_match, contact_entry.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => contact_match_id})

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(
                 query,
                 LCGQL.Schema,
                 variables: %{"id" => contact_match_id},
                 context: context
               )
    end

    test "refetches a viewer-owned media asset from a relay global id" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      media_asset =
        media_asset_fixture(viewer, %{
          storage_key: "uploads/users/#{viewer.id}/processed-node.jpg",
          mime_type: "image/jpeg",
          processing_state: :processed
        })

      media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on MediaAsset {
            mimeType
            processingState
            publicUrl
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^media_asset_id,
                    "mimeType" => "image/jpeg",
                    "processingState" => "PROCESSED",
                    "publicUrl" => returned_public_url
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => media_asset_id},
                 context: context
               )

      assert {:ok, expected_public_url} =
               LC.Infra.ObjectStorage.public_asset_url(media_asset.storage_key)

      assert returned_public_url == expected_public_url
    end

    test "returns null for media asset node lookups without owner scope" do
      owner = user_fixture()
      other_viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(other_viewer)}

      assert {:ok, %{media_asset: media_asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => media_asset_id})

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => media_asset_id},
                 context: context
               )
    end

    test "refetches post report nodes only for the reporter or staff moderators" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      other_user = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)
      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported post"})
      {:ok, report} = Content.report_post(reporter, post, %{reason: :spam})

      assert {:ok, _decided_report} =
               Content.decide_post_report(Accounts.scope_for_user(staff), report.id, %{
                 status: :dismissed,
                 decision_note: "not enough context"
               })

      report_id = Absinthe.Relay.Node.to_global_id(:post_report, report.id, LCGQL.Schema)
      post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)
      reporter_id = Absinthe.Relay.Node.to_global_id(:user, reporter.id, LCGQL.Schema)
      staff_id = Absinthe.Relay.Node.to_global_id(:user, staff.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on PostReport {
            postId
            reporterId
            reason
            status
            decisionNote
            reviewedById
            post {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^report_id,
                    "postId" => ^post_id,
                    "reporterId" => ^reporter_id,
                    "reason" => "SPAM",
                    "status" => "DISMISSED",
                    "decisionNote" => nil,
                    "reviewedById" => nil,
                    "post" => nil
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => report_id},
                 context: %{current_scope: Accounts.scope_for_user(reporter)}
               )

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^report_id,
                    "postId" => ^post_id,
                    "reporterId" => ^reporter_id,
                    "reason" => "SPAM",
                    "status" => "DISMISSED",
                    "decisionNote" => "not enough context",
                    "reviewedById" => ^staff_id,
                    "post" => %{"id" => ^post_id}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => report_id},
                 context: %{current_scope: Accounts.scope_for_user(staff)}
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => report_id},
                 context: %{current_scope: Accounts.scope_for_user(other_user)}
               )
    end

    test "refetches a viewer-owned pending follow request from a relay global id" do
      viewer = user_fixture(privacy_mode: :private)
      follower = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, follow_request} = LC.Social.follow_user(follower, viewer)

      follow_request_id =
        Absinthe.Relay.Node.to_global_id(:follow_request, follow_request.id, LCGQL.Schema)

      follower_id = Absinthe.Relay.Node.to_global_id(:user, follower.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on FollowRequest {
            state
            requestedAt
            follower {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^follow_request_id,
                    "state" => "REQUESTED",
                    "requestedAt" => requested_at,
                    "follower" => %{"id" => ^follower_id}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => follow_request_id},
                 context: context
               )

      assert is_binary(requested_at)
    end

    test "returns null for pending follow request node lookups without owner scope" do
      owner = user_fixture(privacy_mode: :private)
      other_viewer = user_fixture()
      follower = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(other_viewer)}

      assert {:ok, follow_request} = LC.Social.follow_user(follower, owner)

      follow_request_id =
        Absinthe.Relay.Node.to_global_id(:follow_request, follow_request.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => follow_request_id})

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => follow_request_id},
                 context: context
               )
    end

    test "refetches an authorized chat message event from a relay global id" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "hello history"})

      {:ok, ended_session} = Live.end_live_session(live_session)

      assert ended_session.status == :ended

      event_id = Absinthe.Relay.Node.to_global_id(:chat_message_event, event.id, LCGQL.Schema)
      actor_id = Absinthe.Relay.Node.to_global_id(:user, host.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on ChatMessageEvent {
            body
            eventType
            occurredAt
            edited
            editCount
            editedAt
            actor {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^event_id,
                    "body" => "hello history",
                    "eventType" => "CHAT_MESSAGE_SENT",
                    "occurredAt" => occurred_at,
                    "edited" => false,
                    "editCount" => 0,
                    "editedAt" => nil,
                    "actor" => %{"id" => ^actor_id}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => event_id},
                 context: context
               )

      assert is_binary(occurred_at)
    end

    test "refetches a live session recording media asset through the live session node" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      recording_asset =
        media_asset_fixture(host, %{
          storage_key: "uploads/users/#{host.id}/node-recording.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      recording_media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, recording_asset.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on LiveSession {
            recordingMediaAsset {
              id
              processingState
              publicUrl
            }
          }
        }
      }
      """

      assert {:ok, expected_public_url} =
               LC.Infra.ObjectStorage.public_asset_url(recording_asset.storage_key)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^live_session_id,
                    "recordingMediaAsset" => %{
                      "id" => ^recording_media_asset_id,
                      "processingState" => "PROCESSED",
                      "publicUrl" => returned_public_url
                    }
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )

      assert returned_public_url == expected_public_url
    end

    test "refetches an authorized active live session node with the documented fields" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, active_session} = Live.mark_session_live(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, active_session.id, LCGQL.Schema)

      host_id = Absinthe.Relay.Node.to_global_id(:user, host.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on LiveSession {
            status
            visibility
            insertedAt
            startedAt
            endedAt
            host {
              id
            }
            recordingMediaAsset {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^live_session_id,
                    "status" => "LIVE",
                    "visibility" => "PUBLIC",
                    "insertedAt" => inserted_at,
                    "startedAt" => started_at,
                    "endedAt" => nil,
                    "host" => %{"id" => ^host_id},
                    "recordingMediaAsset" => nil
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )

      assert {:ok, _, 0} = DateTime.from_iso8601(inserted_at)
      assert {:ok, _, 0} = DateTime.from_iso8601(started_at)
    end

    test "does not expose owner-only media fields on recordingMediaAsset" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      recording_asset =
        media_asset_fixture(host, %{
          storage_key: "uploads/users/#{host.id}/recording-safe-shape.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          ... on LiveSession {
            recordingMediaAsset {
              storageKey
            }
          }
        }
      }
      """

      assert {:ok, %{errors: [first_error | _rest]}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )

      assert first_error.message =~ "Cannot query field \"storageKey\""
    end

    test "returns nil for unauthorized ended live session node lookups even when a recording is linked" do
      host = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      recording_asset =
        media_asset_fixture(host, %{
          storage_key: "uploads/users/#{host.id}/private-node-recording.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on LiveSession {
            recordingMediaAsset {
              id
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )
    end

    test "returns nil for live session recording media assets when no recording is linked" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on LiveSession {
            recordingMediaAsset {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^live_session_id,
                    "recordingMediaAsset" => nil
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )
    end

    test "ended live session node reads return a null channel topic" do
      host = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(host)}

      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, ended_session} = Live.end_live_session(session)
      relay_id = Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      query = """
      query EndedLiveSessionChannelTopic($id: ID!) {
        node(id: $id) {
          ... on LiveSession {
            id
            channelTopic
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^relay_id,
                    "channelTopic" => nil
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => relay_id},
                 context: context
               )
    end

    test "returns nil for unauthorized follower-only ended live session node lookups" do
      host = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      recording_asset =
        media_asset_fixture(host, %{
          storage_key: "uploads/users/#{host.id}/private-ended-node.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )
    end

    test "returns nil for unauthorized follower-only active live session node lookups" do
      host = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, active_session} = Live.mark_session_live(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, active_session.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )
    end

    test "refetches an authorized follower-visible replay session from a relay global id" do
      host = user_fixture()
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      recording_asset =
        media_asset_fixture(host, %{
          storage_key: "uploads/users/#{host.id}/authorized-replay-node.mp4",
          mime_type: "video/mp4",
          processing_state: :processed
        })

      {:ok, ended_session} =
        Live.end_live_session(live_session, %{recording_media_asset_id: recording_asset.id})

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      recording_media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, recording_asset.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on LiveSession {
            status
            recordingMediaAsset {
              id
            }
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^live_session_id,
                    "status" => "ENDED",
                    "recordingMediaAsset" => %{"id" => ^recording_media_asset_id}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )
    end

    test "returns nil node fallbacks for unauthorized chat history lookups" do
      host = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "private history"})

      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      event_id = Absinthe.Relay.Node.to_global_id(:chat_message_event, event.id, LCGQL.Schema)

      live_session_query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      node_query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(live_session_query, LCGQL.Schema,
                 variables: %{"id" => live_session_id},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(node_query, LCGQL.Schema,
                 variables: %{"id" => event_id},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(node_query, LCGQL.Schema, variables: %{"id" => event_id})
    end

    test "injects a loader into execution context without dropping viewer scope" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, %{media_asset: first_asset}} =
               Content.request_media_upload(viewer, %{mime_type: "image/jpeg"})

      assert {:ok, %{media_asset: second_asset}} =
               Content.request_media_upload(viewer, %{mime_type: "image/png"})

      first_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, first_asset.id, LCGQL.Schema)

      second_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, second_asset.id, LCGQL.Schema)

      query = """
      query($firstId: ID!, $secondId: ID!) {
        firstAsset: node(id: $firstId) {
          ... on MediaAsset {
            id
            publicUrl
          }
        }
        secondAsset: node(id: $secondId) {
          ... on MediaAsset {
            id
            publicUrl
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "firstAsset" => %{"id" => ^first_asset_id, "publicUrl" => nil},
                  "secondAsset" => %{"id" => ^second_asset_id, "publicUrl" => nil}
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"firstId" => first_asset_id, "secondId" => second_asset_id},
                 context: context,
                 pipeline_modifier: &capture_execution_context(&1, &2, self())
               )

      assert_receive {:execution_context, captured_context}
      assert %Dataloader{} = captured_context.loader
      assert captured_context.current_scope.user.id == viewer.id
      assert captured_context.auth_transport == :none
      assert captured_context.auth_error == nil

      assert captured_context.loader.sources[Accounts].default_params.current_scope.user.id ==
               viewer.id
    end

    test "does not expose token fields on the User node" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)
      user_type = schema_type_body!(schema_sdl, "User")

      refute user_type =~ "freshAccessToken"
      refute user_type =~ "refreshToken"
      assert schema_sdl =~ "refreshToken: Token"
    end
  end

  defp capture_execution_context(pipeline, _options, test_pid) do
    Absinthe.Pipeline.insert_after(
      pipeline,
      Absinthe.Phase.Document.Execution.Resolution,
      {CaptureExecutionContextPhase, test_pid: test_pid}
    )
  end

  defp schema_type_body!(schema_sdl, type_name) do
    [_before, rest] = String.split(schema_sdl, "type #{type_name} implements Node {", parts: 2)
    [body | _after] = String.split(rest, "\n}", parts: 2)
    body
  end
end
