defmodule LCGQL.Chat.ChatQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.SocialFixtures
  import Ecto.Query

  alias LC.{Accounts, Chat, Live}
  alias LC.Infra.Repo
  alias LCSchemas.Chat.ChatMessage

  describe "node.liveSession.chatMessages" do
    test "keeps block, mute, reverse-mute, and follower/public history visibility aligned" do
      viewer = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      followed_host = user_fixture()
      blocked_host = user_fixture(privacy_mode: :public)
      muted_host = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      _follow = accepted_follow_fixture(viewer, followed_host)
      _block = block_fixture(blocked_host, viewer)
      _mute = mute_fixture(viewer, muted_host)
      _reverse_mute = mute_fixture(reverse_muter, viewer)

      {:ok, public_session} = Live.start_live_session(public_host, %{visibility: :public})

      assert {:ok, _public_message} =
               Chat.create_message(public_session, public_host, %{body: "public"})

      {:ok, ended_public_session} = Live.end_live_session(public_session)

      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})

      assert {:ok, _followed_message} =
               Chat.create_message(followed_session, followed_host, %{body: "followers"})

      {:ok, ended_followed_session} = Live.end_live_session(followed_session)

      {:ok, blocked_session} = Live.start_live_session(blocked_host, %{visibility: :public})

      assert {:ok, _blocked_message} =
               Chat.create_message(blocked_session, blocked_host, %{body: "blocked"})

      {:ok, ended_blocked_session} = Live.end_live_session(blocked_session)

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})

      assert {:ok, _muted_message} =
               Chat.create_message(muted_session, muted_host, %{body: "muted"})

      {:ok, ended_muted_session} = Live.end_live_session(muted_session)

      {:ok, reverse_muted_session} =
        Live.start_live_session(reverse_muter, %{visibility: :public})

      assert {:ok, _reverse_muted_message} =
               Chat.create_message(reverse_muted_session, reverse_muter, %{body: "reverse-mute"})

      {:ok, ended_reverse_muted_session} = Live.end_live_session(reverse_muted_session)

      query = """
      query(
        $publicSessionId: ID!,
        $followedSessionId: ID!,
        $blockedSessionId: ID!,
        $mutedSessionId: ID!,
        $reverseMutedSessionId: ID!
      ) {
        publicSession: node(id: $publicSessionId) {
          ... on LiveSession {
            id
            chatMessages(first: 10) {
              edges {
                node {
                  body
                }
              }
            }
          }
        }
        followedSession: node(id: $followedSessionId) {
          ... on LiveSession {
            id
            chatMessages(first: 10) {
              edges {
                node {
                  body
                }
              }
            }
          }
        }
        blockedSession: node(id: $blockedSessionId) {
          ... on LiveSession {
            id
            chatMessages(first: 10) {
              edges {
                node {
                  body
                }
              }
            }
          }
        }
        mutedSession: node(id: $mutedSessionId) {
          ... on LiveSession {
            id
            chatMessages(first: 10) {
              edges {
                node {
                  body
                }
              }
            }
          }
        }
        reverseMutedSession: node(id: $reverseMutedSessionId) {
          ... on LiveSession {
            id
            chatMessages(first: 10) {
              edges {
                node {
                  body
                }
              }
            }
          }
        }
      }
      """

      variables = %{
        "publicSessionId" =>
          Absinthe.Relay.Node.to_global_id(:live_session, ended_public_session.id, LCGQL.Schema),
        "followedSessionId" =>
          Absinthe.Relay.Node.to_global_id(:live_session, ended_followed_session.id, LCGQL.Schema),
        "blockedSessionId" =>
          Absinthe.Relay.Node.to_global_id(:live_session, ended_blocked_session.id, LCGQL.Schema),
        "mutedSessionId" =>
          Absinthe.Relay.Node.to_global_id(:live_session, ended_muted_session.id, LCGQL.Schema),
        "reverseMutedSessionId" =>
          Absinthe.Relay.Node.to_global_id(
            :live_session,
            ended_reverse_muted_session.id,
            LCGQL.Schema
          )
      }

      assert {:ok,
              %{
                data: %{
                  "publicSession" => %{
                    "chatMessages" => %{
                      "edges" => [%{"node" => %{"body" => "public"}}]
                    }
                  },
                  "followedSession" => %{
                    "chatMessages" => %{
                      "edges" => [%{"node" => %{"body" => "followers"}}]
                    }
                  },
                  "blockedSession" => nil,
                  "mutedSession" => nil,
                  "reverseMutedSession" => %{
                    "chatMessages" => %{
                      "edges" => [%{"node" => %{"body" => "reverse-mute"}}]
                    }
                  }
                }
              }} = Absinthe.run(query, LCGQL.Schema, variables: variables, context: context)
    end

    test "supports first/after pagination for ended-session history" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, first} = Chat.create_message(live_session, host, %{body: "first"})
      assert {:ok, second} = Chat.create_message(live_session, viewer, %{body: "second"})
      assert {:ok, third} = Chat.create_message(live_session, host, %{body: "third"})
      {:ok, ended_session} = Live.end_live_session(live_session)

      shared_time = ~U[2026-03-17 18:00:00.000000Z]
      later_time = DateTime.add(shared_time, 1, :second)
      set_message_timestamp(first, shared_time)
      set_message_timestamp(second, shared_time)
      set_message_timestamp(third, later_time)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      first_id = Absinthe.Relay.Node.to_global_id(:chat_message, first.id, LCGQL.Schema)
      second_id = Absinthe.Relay.Node.to_global_id(:chat_message, second.id, LCGQL.Schema)
      third_id = Absinthe.Relay.Node.to_global_id(:chat_message, third.id, LCGQL.Schema)
      host_id = Absinthe.Relay.Node.to_global_id(:user, host.id, LCGQL.Schema)
      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "chatMessages" => %{
                      "edges" => first_page_edges,
                      "pageInfo" => %{
                        "startCursor" => start_cursor,
                        "endCursor" => end_cursor,
                        "hasNextPage" => true,
                        "hasPreviousPage" => false
                      }
                    }
                  }
                }
              }} =
               Absinthe.run(chat_history_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 2},
                 context: context
               )

      assert [
               %{
                 "cursor" => first_cursor,
                 "node" => %{
                   "id" => ^first_id,
                   "body" => "first",
                   "kind" => "USER_MESSAGE",
                   "sender" => %{"id" => ^host_id}
                 }
               },
               %{
                 "cursor" => second_cursor,
                 "node" => %{
                   "id" => ^second_id,
                   "body" => "second",
                   "kind" => "USER_MESSAGE",
                   "sender" => %{"id" => ^viewer_id}
                 }
               }
             ] = first_page_edges

      assert is_binary(first_cursor)
      assert is_binary(second_cursor)
      assert is_binary(start_cursor)
      assert is_binary(end_cursor)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "chatMessages" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^third_id,
                            "body" => "third",
                            "kind" => "USER_MESSAGE",
                            "sender" => %{"id" => ^host_id}
                          }
                        }
                      ],
                      "pageInfo" => %{
                        "hasNextPage" => false,
                        "hasPreviousPage" => true
                      }
                    }
                  }
                }
              }} =
               Absinthe.run(chat_history_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 1, "after" => end_cursor},
                 context: context
               )
    end

    test "supports last/before pagination and reports hasPreviousPage" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, first} = Chat.create_message(live_session, host, %{body: "first"})
      assert {:ok, second} = Chat.create_message(live_session, viewer, %{body: "second"})
      assert {:ok, third} = Chat.create_message(live_session, host, %{body: "third"})
      {:ok, ended_session} = Live.end_live_session(live_session)

      shared_time = ~U[2026-03-17 19:00:00.000000Z]
      later_time = DateTime.add(shared_time, 1, :second)
      set_message_timestamp(first, shared_time)
      set_message_timestamp(second, shared_time)
      set_message_timestamp(third, later_time)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      second_id = Absinthe.Relay.Node.to_global_id(:chat_message, second.id, LCGQL.Schema)

      assert {:ok, %{data: %{"node" => %{"chatMessages" => %{"edges" => edges}}}}} =
               Absinthe.run(chat_history_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 3},
                 context: context
               )

      assert [
               _first_edge,
               _second_edge,
               %{"cursor" => third_cursor}
             ] = edges

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "chatMessages" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^second_id,
                            "body" => "second"
                          }
                        }
                      ],
                      "pageInfo" => %{
                        "hasPreviousPage" => true,
                        "startCursor" => start_cursor,
                        "endCursor" => end_cursor
                      }
                    }
                  }
                }
              }} =
               Absinthe.run(chat_history_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "last" => 1, "before" => third_cursor},
                 context: context
               )

      assert is_binary(start_cursor)
      assert is_binary(end_cursor)
    end

    test "redacts moderated messages in history connections and node reads" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(live_session, viewer, %{body: "to be removed"})
      {:ok, removed_message} = Chat.remove_message(message, host)
      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      message_id = Absinthe.Relay.Node.to_global_id(:chat_message, message.id, LCGQL.Schema)
      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
      moderated_at = DateTime.to_iso8601(removed_message.moderated_at)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "chatMessages" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^message_id,
                            "body" => nil,
                            "status" => "REMOVED",
                            "moderatedAt" => ^moderated_at,
                            "sender" => %{"id" => ^viewer_id}
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(chat_history_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "id" => ^message_id,
                    "body" => nil,
                    "status" => "REMOVED",
                    "moderatedAt" => ^moderated_at,
                    "sender" => %{"id" => ^viewer_id}
                  }
                }
              }} =
               Absinthe.run(chat_message_node_query(), LCGQL.Schema,
                 variables: %{"id" => message_id},
                 context: context
               )
    end

    test "returns mixed user and system messages with typed system-event projections" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, first_message} = Chat.create_message(live_session, viewer, %{body: "first"})

      {:ok, system_event} =
        Chat.record_system_event(live_session, :message_removed,
          actor: host,
          metadata: %{chat_message: first_message}
        )

      {:ok, third_message} = Chat.create_message(live_session, host, %{body: "third"})
      {:ok, ended_session} = Live.end_live_session(live_session)

      shared_time = ~U[2026-03-17 21:00:00.000000Z]
      later_time = DateTime.add(shared_time, 1, :second)
      set_message_timestamp(first_message, shared_time)
      set_message_timestamp(system_event, shared_time)
      set_message_timestamp(third_message, later_time)

      live_session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

      first_message_id =
        Absinthe.Relay.Node.to_global_id(:chat_message, first_message.id, LCGQL.Schema)

      system_event_id =
        Absinthe.Relay.Node.to_global_id(:chat_message, system_event.id, LCGQL.Schema)

      third_message_id =
        Absinthe.Relay.Node.to_global_id(:chat_message, third_message.id, LCGQL.Schema)

      first_message_entropy_id = first_message.entropy_id
      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
      host_id = Absinthe.Relay.Node.to_global_id(:user, host.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "chatMessages" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^first_message_id,
                            "body" => "first",
                            "kind" => "USER_MESSAGE",
                            "systemEventType" => nil,
                            "systemEventDetails" => nil,
                            "sender" => %{"id" => ^viewer_id}
                          }
                        },
                        %{
                          "node" => %{
                            "id" => ^system_event_id,
                            "body" => "A chat message was removed.",
                            "kind" => "SYSTEM_EVENT",
                            "systemEventType" => "MESSAGE_REMOVED",
                            "systemEventDetails" => %{
                              "chatMessageId" => ^first_message_id,
                              "chatMessageEntropyId" => ^first_message_entropy_id
                            },
                            "sender" => %{"id" => ^host_id}
                          }
                        },
                        %{
                          "node" => %{
                            "id" => ^third_message_id,
                            "body" => "third",
                            "kind" => "USER_MESSAGE",
                            "systemEventType" => nil,
                            "systemEventDetails" => nil,
                            "sender" => %{"id" => ^host_id}
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(chat_history_with_system_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )
    end
  end

  defp chat_history_query do
    """
    query(
      $id: ID!,
      $first: Int,
      $after: String,
      $last: Int,
      $before: String
    ) {
      node(id: $id) {
        ... on LiveSession {
          chatMessages(first: $first, after: $after, last: $last, before: $before) {
            edges {
              cursor
              node {
                id
                body
                status
                moderatedAt
                kind
                insertedAt
                sender {
                  id
                }
              }
            }
            pageInfo {
              startCursor
              endCursor
              hasNextPage
              hasPreviousPage
            }
          }
        }
      }
    }
    """
  end

  defp chat_message_node_query do
    """
    query($id: ID!) {
      node(id: $id) {
        ... on ChatMessage {
          id
          body
          status
          moderatedAt
          sender {
            id
          }
        }
      }
    }
    """
  end

  defp chat_history_with_system_events_query do
    """
    query($id: ID!, $first: Int) {
      node(id: $id) {
        ... on LiveSession {
          chatMessages(first: $first) {
            edges {
              node {
                id
                body
                kind
                systemEventType
                systemEventDetails {
                  chatMessageId
                  chatMessageEntropyId
                }
                sender {
                  id
                }
              }
            }
          }
        }
      }
    }
    """
  end

  defp set_message_timestamp(%ChatMessage{id: message_id}, %DateTime{} = timestamp) do
    {1, nil} =
      Repo.update_all(from(message in ChatMessage, where: message.id == ^message_id),
        set: [inserted_at: timestamp, updated_at: timestamp]
      )
  end
end
