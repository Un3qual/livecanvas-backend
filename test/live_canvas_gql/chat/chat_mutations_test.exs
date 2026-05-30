defmodule LCGQL.Chat.ChatMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import Ecto.Query

  alias LC.{Accounts, Chat, Live}
  alias LC.Infra.Repo
  alias LCTransport.LiveSessionTopics
  alias LCSchemas.Chat.ChatMessage

  describe "removeLiveChatMessage" do
    test "allows the session host to remove a viewer-authored message" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(host)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(live_session, sender, %{body: "abusive message"})

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)
      sender_id = Absinthe.Relay.Node.to_global_id(:user, sender.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => %{
                      "id" => ^message_id,
                      "body" => nil,
                      "status" => "REMOVED",
                      "moderatedAt" => moderated_at,
                      "sender" => %{"id" => ^sender_id}
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => message_id},
                 context: context
               )

      assert is_binary(moderated_at)
      assert %{status: :removed} = Chat.get_history_message(host, message.id)
    end

    test "records and broadcasts one message_removed system event for the first removal" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(host)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      live_session_id = live_session.id
      {:ok, message} = Chat.create_message(live_session, sender, %{body: "remove me"})
      topic = LiveSessionTopics.live_session_topic(live_session.id)
      :ok = Phoenix.PubSub.subscribe(LC.PubSub, topic)

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => %{
                      "id" => ^message_id,
                      "body" => nil,
                      "status" => "REMOVED",
                      "moderatedAt" => moderated_at
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => message_id},
                 context: context
               )

      assert is_binary(moderated_at)

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^topic,
        event: "chat:message",
        payload: %{
          message: %{
            id: system_event_id,
            body: "A chat message was removed.",
            sender_id: sender_id,
            inserted_at: inserted_at,
            kind: "system_event",
            status: "active",
            moderated_at: nil,
            metadata: %{
              "details" => %{
                "chat_message_entropy_id" => chat_message_entropy_id,
                "chat_message_id" => chat_message_id
              },
              "event_type" => "message_removed"
            }
          }
        }
      }

      assert is_integer(system_event_id)
      assert sender_id == host.id
      assert is_binary(inserted_at)
      assert chat_message_id == message.id
      assert chat_message_entropy_id == message.entropy_id

      assert [
               %ChatMessage{
                 id: ^system_event_id,
                 live_session_id: ^live_session_id,
                 sender_id: ^sender_id,
                 body: "A chat message was removed.",
                 kind: :system_event,
                 status: :active,
                 metadata: %{
                   "details" => %{
                     "chat_message_entropy_id" => ^chat_message_entropy_id,
                     "chat_message_id" => ^chat_message_id
                   },
                   "event_type" => "message_removed"
                 }
               }
             ] =
               from(chat_message in ChatMessage,
                 where:
                   chat_message.live_session_id == ^live_session.id and
                     chat_message.kind == :system_event,
                 order_by: [asc: chat_message.inserted_at, asc: chat_message.id]
               )
               |> Repo.all()
    end

    test "returns not_authorized when the sender is not the session host" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(sender)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(live_session, sender, %{body: "cannot self-remove"})
      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => nil,
                    "errors" => [%{"message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => message_id},
                 context: context
               )
    end

    test "returns not_authorized for a host from another live session" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      outsider = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _outsider_session} = Live.start_live_session(outsider, %{visibility: :public})

      {:ok, message} =
        Chat.create_message(live_session, sender, %{body: "still not your session"})

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => nil,
                    "errors" => [%{"message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => message_id},
                 context: context
               )
    end

    test "is idempotent and reuses the first moderation timestamp" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(host)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(live_session, sender, %{body: "remove once"})
      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => %{"moderatedAt" => moderated_at},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => message_id},
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => %{
                      "id" => ^message_id,
                      "body" => nil,
                      "status" => "REMOVED",
                      "moderatedAt" => ^moderated_at
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => message_id},
                 context: context
               )

      assert 1 ==
               from(chat_message in ChatMessage,
                 where:
                   chat_message.live_session_id == ^live_session.id and
                     chat_message.kind == :system_event
               )
               |> Repo.aggregate(:count)
    end

    test "does not emit another removal event when removing a system event row" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(host)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(live_session, sender, %{body: "remove me"})

      assert {:ok, system_event} =
               Chat.record_system_event(live_session, :message_removed,
                 actor: host,
                 metadata: %{chat_message: message}
               )

      topic = LiveSessionTopics.live_session_topic(live_session.id)
      :ok = Phoenix.PubSub.subscribe(LC.PubSub, topic)

      system_event_id =
        Absinthe.Relay.Node.to_global_id(:chat_message, system_event.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessage" => %{
                    "chatMessage" => %{
                      "id" => ^system_event_id,
                      "body" => nil,
                      "status" => "REMOVED",
                      "moderatedAt" => moderated_at
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageId" => system_event_id},
                 context: context
               )

      assert is_binary(moderated_at)

      assert_receive %Phoenix.Socket.Broadcast{
        topic: ^topic,
        event: "chat:message_updated",
        payload: %{message: %{id: updated_id, body: nil, kind: "system_event", status: "removed"}}
      }

      assert updated_id == system_event.id

      refute_receive %Phoenix.Socket.Broadcast{
                       topic: ^topic,
                       event: "chat:message",
                       payload: %{message: %{metadata: %{"event_type" => "message_removed"}}}
                     },
                     200

      assert 1 ==
               from(chat_message in ChatMessage,
                 where:
                   chat_message.live_session_id == ^live_session.id and
                     chat_message.kind == :system_event
               )
               |> Repo.aggregate(:count)
    end
  end

  defp remove_message_mutation do
    """
    mutation($chatMessageId: ID!) {
      removeLiveChatMessage(input: { chatMessageId: $chatMessageId }) {
        chatMessage {
          id
          body
          status
          moderatedAt
          sender {
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
  end
end
