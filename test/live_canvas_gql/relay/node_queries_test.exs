defmodule LCGQL.Relay.NodeQueriesTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  alias LC.{Accounts, Chat, Content, Live}

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

    test "returns nil for recording media assets when the viewer cannot read session history" do
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

    test "returns safe null or empty fallbacks for unauthorized chat history node lookups" do
      host = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})
      assert {:ok, message} = Chat.create_message(live_session, host, %{body: "private history"})
      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)

      history_query = """
      query($id: ID!) {
        node(id: $id) {
          ... on LiveSession {
            chatMessages(first: 10) {
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

      node_query = """
      query($id: ID!) {
        node(id: $id) {
          id
        }
      }
      """

      assert {:ok, %{data: %{"node" => %{"chatMessages" => %{"edges" => []}}}}} =
               Absinthe.run(history_query, LCGQL.Schema,
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
  end
end
