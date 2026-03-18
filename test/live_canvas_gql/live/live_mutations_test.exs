defmodule LCGQL.Live.LiveMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import Ecto.Query

  alias LC.{Accounts, Content, Live}
  alias LC.Infra.Repo
  alias LCSchemas.{Chat.ChatMessage, Live.LiveParticipant, Live.LiveSession}

  describe "startLiveSession" do
    test "starts a live session for the authenticated viewer" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        startLiveSession(input: {visibility: FOLLOWERS}) {
          liveSession {
            id
            status
            visibility
            host {
              id
            }
          }
          errors {
            field
            message
          }
        }
      }
      """

      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "startLiveSession" => %{
                    "liveSession" => %{
                      "id" => live_session_id,
                      "status" => "STARTING",
                      "visibility" => "FOLLOWERS",
                      "host" => %{"id" => ^viewer_id}
                    },
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert {:ok, %{id: local_id, type: :live_session}} =
               Absinthe.Relay.Node.from_global_id(live_session_id, LCGQL.Schema)

      local_id = String.to_integer(local_id)
      assert %{id: ^local_id, host_id: host_id} = Live.get_live_session!(local_id)

      assert host_id == viewer.id
    end

    test "returns an unauthenticated error when no viewer scope is present" do
      mutation = """
      mutation {
        startLiveSession(input: {visibility: FOLLOWERS}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "startLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "goLiveSession and endLiveSession" do
    test "allows only the host to transition lifecycle states" do
      host = user_fixture()
      other_viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})

      session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)

      go_live_mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      end_mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      other_context = %{current_scope: Accounts.scope_for_user(other_viewer)}

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(
                 go_live_mutation,
                 LCGQL.Schema,
                 context: other_context,
                 variables: %{"liveSessionId" => session_id}
               )

      host_context = %{current_scope: Accounts.scope_for_user(host)}

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "LIVE"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 go_live_mutation,
                 LCGQL.Schema,
                 context: host_context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 end_mutation,
                 LCGQL.Schema,
                 context: host_context,
                 variables: %{"liveSessionId" => session_id}
               )
    end

    test "persists and broadcasts lifecycle system events for successful host transitions" do
      host = user_fixture(privacy_mode: :public)
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      topic = "live_session:#{started_session.id}"
      :ok = Phoenix.PubSub.subscribe(LC.PubSub, topic)

      session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)

      context = %{current_scope: Accounts.scope_for_user(host)}

      go_live_mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      end_mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "LIVE"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 go_live_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^topic,
        event: "chat:message",
        payload: %{
          message: %{
            id: go_live_message_id,
            body: "The live session started.",
            sender_id: sender_id,
            inserted_at: go_live_inserted_at,
            kind: "system_event",
            status: "active",
            moderated_at: nil,
            metadata: %{"details" => %{}, "event_type" => "session_live"}
          }
        }
      }

      assert is_integer(go_live_message_id)
      assert sender_id == host.id
      assert is_binary(go_live_inserted_at)

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 end_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^topic,
        event: "chat:message",
        payload: %{
          message: %{
            id: end_message_id,
            body: "The live session ended.",
            sender_id: sender_id,
            inserted_at: end_inserted_at,
            kind: "system_event",
            status: "active",
            moderated_at: nil,
            metadata: %{"details" => %{}, "event_type" => "session_ended"}
          }
        }
      }

      assert is_integer(end_message_id)
      assert sender_id == host.id
      assert is_binary(end_inserted_at)

      assert [
               %ChatMessage{
                 id: ^go_live_message_id,
                 body: "The live session started.",
                 sender_id: ^sender_id,
                 kind: :system_event,
                 status: :active,
                 metadata: %{"details" => %{}, "event_type" => "session_live"}
               },
               %ChatMessage{
                 id: ^end_message_id,
                 body: "The live session ended.",
                 sender_id: ^sender_id,
                 kind: :system_event,
                 status: :active,
                 metadata: %{"details" => %{}, "event_type" => "session_ended"}
               }
             ] =
               from(chat_message in ChatMessage,
                 where:
                   chat_message.live_session_id == ^started_session.id and
                     chat_message.kind == :system_event,
                 order_by: [asc: chat_message.inserted_at, asc: chat_message.id]
               )
               |> Repo.all()
    end

    test "does not emit session_live when a concurrent end wins before the go-live reload" do
      host = user_fixture(privacy_mode: :public)
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      topic = "live_session:#{started_session.id}"
      :ok = Phoenix.PubSub.subscribe(LC.PubSub, topic)
      session_id = Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(host)}
      test_pid = self()

      go_live_mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      end_mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      lock_task =
        Task.async(fn ->
          Repo.transaction(fn ->
            from(live_session in LiveSession,
              where: live_session.id == ^started_session.id,
              lock: "FOR UPDATE"
            )
            |> Repo.one!()

            send(test_pid, :live_session_locked)

            receive do
              :release_live_session_lock -> :ok
            after
              5_000 -> exit(:release_live_session_lock_timeout)
            end
          end)
        end)

      allow_live_db(lock_task.pid)
      assert_receive :live_session_locked

      go_live_task =
        Task.async(fn ->
          Absinthe.run(
            go_live_mutation,
            LCGQL.Schema,
            context: context,
            variables: %{"liveSessionId" => session_id}
          )
        end)

      allow_live_db(go_live_task.pid)
      Process.sleep(20)

      end_task =
        Task.async(fn ->
          Absinthe.run(
            end_mutation,
            LCGQL.Schema,
            context: context,
            variables: %{"liveSessionId" => session_id}
          )
        end)

      allow_live_db(end_task.pid)
      send(lock_task.pid, :release_live_session_lock)

      assert {:ok, _lock_result} = Task.await(lock_task, 5_000)

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                    "errors" => []
                  }
                }
              }} = Task.await(go_live_task, 5_000)

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                    "errors" => []
                  }
                }
              }} = Task.await(end_task, 5_000)

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^topic,
        event: "chat:message",
        payload: %{message: %{metadata: %{"event_type" => "session_ended"}}}
      }

      refute_receive %Phoenix.Socket.Broadcast{
        topic: ^topic,
        event: "chat:message",
        payload: %{message: %{metadata: %{"event_type" => "session_live"}}}
      },
      200
    end

    test "rejects repeated end transitions once a session is already ended" do
      host = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, first_end} = Live.end_live_session(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, first_end.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(host)}

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "ended"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      persisted = Live.get_live_session!(first_end.id)
      assert persisted.ended_at == first_end.ended_at
    end

    test "links a host-owned recording asset through endLiveSession" do
      host = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
                 storage_key: "uploads/users/#{host.id}/graphql-recording.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)

      recording_media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, recording_asset.id, LCGQL.Schema)

      context = %{current_scope: Accounts.scope_for_user(host)}

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!, $recordingMediaAssetId: ID) {
        endLiveSession(
          input: {
            liveSessionId: $liveSessionId
            recordingMediaAssetId: $recordingMediaAssetId
          }
        ) {
          liveSession {
            id
            status
            recordingMediaAsset {
              id
              processingState
              publicUrl
            }
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok, expected_public_url} =
               LC.Infra.ObjectStorage.public_asset_url(recording_asset.storage_key)

      expected_recording_media_asset_local_id = recording_asset.id

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => %{
                      "id" => ^session_id,
                      "status" => "ENDED",
                      "recordingMediaAsset" => %{
                        "id" => ^recording_media_asset_id,
                        "processingState" => "UPLOADED",
                        "publicUrl" => returned_public_url
                      }
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{
                   "liveSessionId" => session_id,
                   "recordingMediaAssetId" => recording_media_asset_id
                 }
               )

      assert returned_public_url == expected_public_url

      assert %{recording_media_asset_id: ^expected_recording_media_asset_local_id} =
               Live.get_live_session!(started_session.id)
    end

    test "returns structured invalid-id errors for non-media-asset recording IDs" do
      host = user_fixture()
      other_user = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      session_id = Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)
      invalid_recording_id = Absinthe.Relay.Node.to_global_id(:user, other_user.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(host)}

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!, $recordingMediaAssetId: ID) {
        endLiveSession(
          input: {
            liveSessionId: $liveSessionId
            recordingMediaAssetId: $recordingMediaAssetId
          }
        ) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => "recordingMediaAssetId", "message" => "is invalid"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{
                   "liveSessionId" => session_id,
                   "recordingMediaAssetId" => invalid_recording_id
                 }
               )
    end

    test "returns mutation errors when the recording asset belongs to another user" do
      host = user_fixture()
      other_user = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, recording_asset} =
               Content.create_media_asset(other_user, %{
                 storage_key: "uploads/users/#{other_user.id}/graphql-foreign-recording.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)

      recording_media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, recording_asset.id, LCGQL.Schema)

      context = %{current_scope: Accounts.scope_for_user(host)}

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!, $recordingMediaAssetId: ID) {
        endLiveSession(
          input: {
            liveSessionId: $liveSessionId
            recordingMediaAssetId: $recordingMediaAssetId
          }
        ) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [
                      %{
                        "field" => "recordingMediaAssetId",
                        "message" => "must belong to the session host"
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{
                   "liveSessionId" => session_id,
                   "recordingMediaAssetId" => recording_media_asset_id
                 }
               )
    end

    test "returns mutation errors when the recording asset is not uploaded or processed" do
      host = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, %{media_asset: recording_asset}} =
               Content.request_media_upload(host, %{mime_type: "video/mp4"})

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)

      recording_media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, recording_asset.id, LCGQL.Schema)

      context = %{current_scope: Accounts.scope_for_user(host)}

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!, $recordingMediaAssetId: ID) {
        endLiveSession(
          input: {
            liveSessionId: $liveSessionId
            recordingMediaAssetId: $recordingMediaAssetId
          }
        ) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [
                      %{
                        "field" => "recordingMediaAssetId",
                        "message" => "must be uploaded or processed"
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{
                   "liveSessionId" => session_id,
                   "recordingMediaAssetId" => recording_media_asset_id
                 }
               )
    end

    test "broadcasts one disconnect when concurrent end requests race" do
      host = user_fixture(privacy_mode: :public)
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(started_session)
      session_id = Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(host)}
      control_topic = "live_session_control:#{live_session.id}"
      session_topic = "live_session:#{live_session.id}"
      :ok = Phoenix.PubSub.subscribe(LC.PubSub, control_topic)
      :ok = Phoenix.PubSub.subscribe(LC.PubSub, session_topic)

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      tasks =
        Enum.map(1..2, fn _attempt ->
          Task.async(fn ->
            Absinthe.run(
              mutation,
              LCGQL.Schema,
              context: context,
              variables: %{"liveSessionId" => session_id}
            )
          end)
        end)

      Enum.each(tasks, &allow_live_db(&1.pid))

      assert Enum.all?(
               Enum.map(tasks, &Task.await(&1, 5_000)),
               &match?(
                 {:ok,
                  %{
                    data: %{
                      "endLiveSession" => %{
                        "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                        "errors" => []
                      }
                    }
                  }},
                 &1
               )
             )

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^session_topic,
        event: "chat:message",
        payload: %{message: %{metadata: %{"event_type" => "session_ended"}}}
      }

      refute_receive %Phoenix.Socket.Broadcast{
        topic: ^session_topic,
        event: "chat:message",
        payload: %{message: %{metadata: %{"event_type" => "session_ended"}}}
      },
      200

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^control_topic,
        event: "disconnect",
        payload: %{reason: "session_ended"}
      }

      refute_receive %Phoenix.Socket.Broadcast{
        topic: ^control_topic,
        event: "disconnect",
        payload: %{reason: "session_ended"}
      },
      200
    end

    test "returns ended when go-live loses a concurrent end race after joinable-state checks" do
      host = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})
      session_id = Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(host)}
      test_pid = self()

      go_live_mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      end_mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      lock_task =
        Task.async(fn ->
          Repo.transaction(fn ->
            from(live_session in LiveSession,
              where: live_session.id == ^started_session.id,
              lock: "FOR UPDATE"
            )
            |> Repo.one!()

            send(test_pid, :live_session_locked)

            receive do
              :release_live_session_lock -> :ok
            after
              5_000 -> exit(:release_live_session_lock_timeout)
            end
          end)
        end)

      allow_live_db(lock_task.pid)
      assert_receive :live_session_locked

      end_task =
        Task.async(fn ->
          Absinthe.run(
            end_mutation,
            LCGQL.Schema,
            context: context,
            variables: %{"liveSessionId" => session_id}
          )
        end)

      allow_live_db(end_task.pid)
      Process.sleep(20)

      go_live_task =
        Task.async(fn ->
          Absinthe.run(
            go_live_mutation,
            LCGQL.Schema,
            context: context,
            variables: %{"liveSessionId" => session_id}
          )
        end)

      allow_live_db(go_live_task.pid)
      send(lock_task.pid, :release_live_session_lock)

      assert {:ok, _lock_result} = Task.await(lock_task, 5_000)

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                    "errors" => []
                  }
                }
              }} = Task.await(end_task, 5_000)

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "ended"}]
                  }
                }
              }} = Task.await(go_live_task, 5_000)
    end
  end

  describe "joinLiveSession and leaveLiveSession" do
    test "allows viewers to join and leave joinable sessions" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      join_mutation = """
      mutation JoinLiveSession($liveSessionId: ID!) {
        joinLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      leave_mutation = """
      mutation LeaveLiveSession($liveSessionId: ID!) {
        leaveLiveSession(input: {liveSessionId: $liveSessionId}) {
          left
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "joinLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "LIVE"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert {:ok,
              %{
                data: %{
                  "leaveLiveSession" => %{
                    "left" => true,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 leave_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )
    end

    test "applies the channel join rate limit to joinLiveSession" do
      previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

      Application.put_env(
        :live_canvas,
        LC.RateLimiter,
        limits: [
          graphql_mutation: [limit: 10, window_ms: 60_000],
          moderation_action: [limit: 10, window_ms: 60_000],
          auth_login: [limit: 10, window_ms: 60_000],
          channel_join: [limit: 1, window_ms: 60_000],
          chat_send: [limit: 10, window_ms: 60_000]
        ]
      )

      LC.RateLimiter.reset!()

      on_exit(fn ->
        Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
        LC.RateLimiter.reset!()
      end)

      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      join_mutation = """
      mutation JoinLiveSession($liveSessionId: ID!) {
        joinLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "joinLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert {:ok,
              %{
                data: %{
                  "joinLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "rate_limited"}]
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )
    end

    test "enforces host audience authorization before joining a followers-only session" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, live_session} = Live.mark_session_live(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      join_mutation = """
      mutation JoinLiveSession($liveSessionId: ID!) {
        joinLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "joinLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      refute Repo.get_by(LiveParticipant, live_session_id: live_session.id, user_id: viewer.id)
    end

    test "allows leave cleanup even after the session has ended" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(started_session)
      assert {:ok, _participant} = Live.join_live_session(live_session, viewer, :viewer)
      {:ok, ended_session} = Live.end_live_session(live_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      leave_mutation = """
      mutation LeaveLiveSession($liveSessionId: ID!) {
        leaveLiveSession(input: {liveSessionId: $liveSessionId}) {
          left
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "leaveLiveSession" => %{
                    "left" => true,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 leave_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert left_at =
               from(participant in LiveParticipant,
                 where:
                   participant.live_session_id == ^ended_session.id and
                     participant.user_id == ^viewer.id,
                 select: participant.left_at
               )
               |> Repo.one()

      assert %DateTime{} = left_at
    end
  end

  describe "live mutation ID handling" do
    test "returns structured invalid-id errors for non-live-session global IDs" do
      viewer = user_fixture()
      other_user = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      non_session_id = Absinthe.Relay.Node.to_global_id(:user, other_user.id, LCGQL.Schema)

      mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => "liveSessionId", "message" => "is invalid"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => non_session_id}
               )
    end
  end

  defp allow_live_db(pid) when is_pid(pid) do
    case Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid) do
      :ok -> :ok
      {:already, _owner} -> :ok
      :not_found -> :ok
    end
  end
end
