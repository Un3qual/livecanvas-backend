defmodule LCGQL.Chat.ChatQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import Ecto.Query

  alias LC.{Accounts, Chat, Live}
  alias LC.Infra.Repo
  alias LCSchemas.Chat.ChatMessage

  describe "node.liveSession.chatMessages" do
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

  defp set_message_timestamp(%ChatMessage{id: message_id}, %DateTime{} = timestamp) do
    {1, nil} =
      Repo.update_all(from(message in ChatMessage, where: message.id == ^message_id),
        set: [inserted_at: timestamp, updated_at: timestamp]
      )
  end
end
