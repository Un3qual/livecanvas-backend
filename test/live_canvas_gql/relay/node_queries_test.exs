defmodule LCGQL.Relay.NodeQueriesTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Content, Live}
  alias LCSchemas.Content.Post

  defmodule CaptureExecutionContextPhase do
    use Absinthe.Phase

    @impl true
    def run(blueprint, opts) do
      send(opts[:test_pid], {:execution_context, blueprint.execution.context})
      {:ok, blueprint}
    end
  end

  describe "node" do
    test "refetches a user from a relay global id" do
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

      assert {:ok, %{data: %{"node" => %{"id" => ^global_id, "email" => user_email}}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"id" => global_id})

      assert user_email == user.email
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

      assert {:ok, replay_asset} =
               Content.create_media_asset(owner, %{
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

      assert {:ok, replay_asset} =
               Content.create_media_asset(owner, %{
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
                    "matchedUsers" => [%{"id" => ^matched_user_id, "email" => matched_email}]
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => contact_match_id},
                 context: context
               )

      assert matched_email == matched_user.email
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

      assert {:ok, %{media_asset: media_asset}} =
               Content.request_media_upload(viewer, %{mime_type: "image/jpeg"})

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

      assert {:ok, expected_public_url} =
               LC.Infra.ObjectStorage.public_asset_url(media_asset.storage_key)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^media_asset_id,
                    "mimeType" => "image/jpeg",
                    "processingState" => "PENDING_UPLOAD",
                    "publicUrl" => returned_public_url
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => media_asset_id},
                 context: context
               )

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

    test "refetches post report nodes only for the reporter" do
      author = user_fixture()
      reporter = user_fixture()
      other_user = user_fixture()
      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported post"})
      {:ok, report} = Content.report_post(reporter, post, %{reason: :spam})

      report_id = Absinthe.Relay.Node.to_global_id(:post_report, report.id, LCGQL.Schema)
      post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)
      reporter_id = Absinthe.Relay.Node.to_global_id(:user, reporter.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on PostReport {
            postId
            reporterId
            reason
            status
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
                    "status" => "OPEN"
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => report_id},
                 context: %{current_scope: Accounts.scope_for_user(reporter)}
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

    test "refetches an authorized chat message from a relay global id" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, message} = Chat.create_message(live_session, host, %{body: "hello history"})
      {:ok, ended_session} = Live.end_live_session(live_session)

      assert ended_session.status == :ended

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)
      sender_id = Absinthe.Relay.Node.to_global_id(:user, host.id, LCGQL.Schema)

      query = """
      query($id: ID!) {
        node(id: $id) {
          id
          ... on ChatMessage {
            body
            kind
            insertedAt
            sender {
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
                    "id" => ^message_id,
                    "body" => "hello history",
                    "kind" => "USER_MESSAGE",
                    "insertedAt" => inserted_at,
                    "sender" => %{"id" => ^sender_id}
                  }
                }
              }} =
               Absinthe.run(query, LCGQL.Schema,
                 variables: %{"id" => message_id},
                 context: context
               )

      assert is_binary(inserted_at)
    end

    test "refetches a live session recording media asset through the live session node" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
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

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
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

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
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

    test "returns nil for unauthorized follower-only ended live session node lookups" do
      host = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
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

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
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
      assert {:ok, message} = Chat.create_message(live_session, host, %{body: "private history"})
      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)

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
                 variables: %{"id" => message_id},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(node_query, LCGQL.Schema, variables: %{"id" => message_id})
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

      assert {:ok, first_public_url} =
               LC.Infra.ObjectStorage.public_asset_url(first_asset.storage_key)

      assert {:ok, second_public_url} =
               LC.Infra.ObjectStorage.public_asset_url(second_asset.storage_key)

      assert {:ok,
              %{
                data: %{
                  "firstAsset" => %{"id" => ^first_asset_id, "publicUrl" => ^first_public_url},
                  "secondAsset" => %{"id" => ^second_asset_id, "publicUrl" => ^second_public_url}
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
  end

  defp capture_execution_context(pipeline, _options, test_pid) do
    Absinthe.Pipeline.insert_after(
      pipeline,
      Absinthe.Phase.Document.Execution.Resolution,
      {CaptureExecutionContextPhase, test_pid: test_pid}
    )
  end
end
