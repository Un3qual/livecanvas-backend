defmodule LCGQL.Chat.ChatQueriesTest do
  use LC.DataCase

  import Ecto.Query
  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Live}
  alias LC.Infra.Repo

  alias LCSchemas.Chat.{
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState
  }

  describe "node.liveSession.timelineEvents" do
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

      assert {:ok, _public_event} =
               Chat.create_timeline_chat_message(public_session, public_host, %{body: "public"})

      {:ok, ended_public_session} = Live.end_live_session(public_session)

      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})

      assert {:ok, _followed_event} =
               Chat.create_timeline_chat_message(followed_session, followed_host, %{
                 body: "followers"
               })

      {:ok, ended_followed_session} = Live.end_live_session(followed_session)

      {:ok, blocked_session} = Live.start_live_session(blocked_host, %{visibility: :public})

      assert {:ok, _blocked_event} =
               Chat.create_timeline_chat_message(blocked_session, blocked_host, %{body: "blocked"})

      {:ok, ended_blocked_session} = Live.end_live_session(blocked_session)

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})

      assert {:ok, _muted_event} =
               Chat.create_timeline_chat_message(muted_session, muted_host, %{body: "muted"})

      {:ok, ended_muted_session} = Live.end_live_session(muted_session)

      {:ok, reverse_muted_session} =
        Live.start_live_session(reverse_muter, %{visibility: :public})

      assert {:ok, _reverse_muted_event} =
               Chat.create_timeline_chat_message(reverse_muted_session, reverse_muter, %{
                 body: "reverse-mute"
               })

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
            timelineEvents(first: 10) {
              edges {
                node {
                  ... on ChatMessageEvent {
                    body
                  }
                }
              }
            }
          }
        }
        followedSession: node(id: $followedSessionId) {
          ... on LiveSession {
            id
            timelineEvents(first: 10) {
              edges {
                node {
                  ... on ChatMessageEvent {
                    body
                  }
                }
              }
            }
          }
        }
        blockedSession: node(id: $blockedSessionId) {
          ... on LiveSession {
            id
            timelineEvents(first: 10) {
              edges {
                node {
                  ... on ChatMessageEvent {
                    body
                  }
                }
              }
            }
          }
        }
        mutedSession: node(id: $mutedSessionId) {
          ... on LiveSession {
            id
            timelineEvents(first: 10) {
              edges {
                node {
                  ... on ChatMessageEvent {
                    body
                  }
                }
              }
            }
          }
        }
        reverseMutedSession: node(id: $reverseMutedSessionId) {
          ... on LiveSession {
            id
            timelineEvents(first: 10) {
              edges {
                node {
                  ... on ChatMessageEvent {
                    body
                  }
                }
              }
            }
          }
        }
      }
      """

      variables = %{
        "publicSessionId" => global_id(:live_session, ended_public_session.id),
        "followedSessionId" => global_id(:live_session, ended_followed_session.id),
        "blockedSessionId" => global_id(:live_session, ended_blocked_session.id),
        "mutedSessionId" => global_id(:live_session, ended_muted_session.id),
        "reverseMutedSessionId" => global_id(:live_session, ended_reverse_muted_session.id)
      }

      assert {:ok,
              %{
                data: %{
                  "publicSession" => %{
                    "timelineEvents" => %{
                      "edges" => [%{"node" => %{"body" => "public"}}]
                    }
                  },
                  "followedSession" => %{
                    "timelineEvents" => %{
                      "edges" => [%{"node" => %{"body" => "followers"}}]
                    }
                  },
                  "blockedSession" => nil,
                  "mutedSession" => nil,
                  "reverseMutedSession" => %{
                    "timelineEvents" => %{
                      "edges" => [%{"node" => %{"body" => "reverse-mute"}}]
                    }
                  }
                }
              }} = Absinthe.run(query, LCGQL.Schema, variables: variables, context: context)
    end

    test "supports first/after pagination for timeline events in occurred_at and id order" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, first} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "first"})

      assert {:ok, second} =
               Chat.create_timeline_chat_message(live_session, viewer, %{body: "second"})

      assert {:ok, third} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "third"})

      {:ok, ended_session} = Live.end_live_session(live_session)

      shared_time = ~U[2026-03-17 18:00:00.000000Z]
      later_time = DateTime.add(shared_time, 1, :second)
      set_timeline_event_timestamp(first, shared_time)
      set_timeline_event_timestamp(second, shared_time)
      set_timeline_event_timestamp(third, later_time)

      live_session_id = global_id(:live_session, ended_session.id)
      first_id = global_id(:chat_message_event, first.id)
      second_id = global_id(:chat_message_event, second.id)
      third_id = global_id(:chat_message_event, third.id)
      host_id = global_id(:user, host.id)
      viewer_id = global_id(:user, viewer.id)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "timelineEvents" => %{
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
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 2},
                 context: context
               )

      assert [
               %{
                 "cursor" => first_cursor,
                 "node" => %{
                   "__typename" => "ChatMessageEvent",
                   "id" => ^first_id,
                   "eventType" => "CHAT_MESSAGE_SENT",
                   "occurredAt" => _first_occurred_at,
                   "actor" => %{"id" => ^host_id},
                   "body" => "first",
                   "edited" => false,
                   "editCount" => 0,
                   "editedAt" => nil
                 }
               },
               %{
                 "cursor" => second_cursor,
                 "node" => %{
                   "__typename" => "ChatMessageEvent",
                   "id" => ^second_id,
                   "eventType" => "CHAT_MESSAGE_SENT",
                   "actor" => %{"id" => ^viewer_id},
                   "body" => "second"
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
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "__typename" => "ChatMessageEvent",
                            "id" => ^third_id,
                            "eventType" => "CHAT_MESSAGE_SENT",
                            "actor" => %{"id" => ^host_id},
                            "body" => "third"
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
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 1, "after" => end_cursor},
                 context: context
               )
    end

    test "supports last/before pagination and reports hasPreviousPage" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, first} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "first"})

      assert {:ok, second} =
               Chat.create_timeline_chat_message(live_session, viewer, %{body: "second"})

      assert {:ok, third} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "third"})

      {:ok, ended_session} = Live.end_live_session(live_session)

      shared_time = ~U[2026-03-17 19:00:00.000000Z]
      later_time = DateTime.add(shared_time, 1, :second)
      set_timeline_event_timestamp(first, shared_time)
      set_timeline_event_timestamp(second, shared_time)
      set_timeline_event_timestamp(third, later_time)

      live_session_id = global_id(:live_session, ended_session.id)
      second_id = global_id(:chat_message_event, second.id)

      assert {:ok, %{data: %{"node" => %{"timelineEvents" => %{"edges" => edges}}}}} =
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
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
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "__typename" => "ChatMessageEvent",
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
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "last" => 1, "before" => third_cursor},
                 context: context
               )

      assert is_binary(start_cursor)
      assert is_binary(end_cursor)
    end

    test "omits events authored by a user who blocked the viewer" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      blocking_actor = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, visible_event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "visible"})

      assert {:ok, hidden_event} =
               Chat.create_timeline_chat_message(live_session, blocking_actor, %{body: "hidden"})

      {:ok, ended_session} = Live.end_live_session(live_session)
      _block = block_fixture(blocking_actor, viewer)

      visible_id = global_id(:chat_message_event, visible_event.id)
      hidden_id = global_id(:chat_message_event, hidden_event.id)
      live_session_id = global_id(:live_session, ended_session.id)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^visible_id,
                            "body" => "visible"
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(timeline_event_node_query(), LCGQL.Schema,
                 variables: %{"id" => hidden_id},
                 context: context
               )
    end

    test "omits events authored by a user the viewer blocked" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      blocked_actor = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, visible_event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "visible"})

      assert {:ok, hidden_event} =
               Chat.create_timeline_chat_message(live_session, blocked_actor, %{body: "hidden"})

      {:ok, ended_session} = Live.end_live_session(live_session)
      _block = block_fixture(viewer, blocked_actor)

      visible_id = global_id(:chat_message_event, visible_event.id)
      hidden_id = global_id(:chat_message_event, hidden_event.id)
      live_session_id = global_id(:live_session, ended_session.id)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "id" => ^visible_id,
                            "body" => "visible"
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(timeline_event_node_query(), LCGQL.Schema,
                 variables: %{"id" => hidden_id},
                 context: context
               )
    end

    test "omits removed message projections from timeline events and node refetch" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      {:ok, removed_event} =
        Chat.create_timeline_chat_message(live_session, viewer, %{body: "remove"})

      {:ok, kept_event} = Chat.create_timeline_chat_message(live_session, host, %{body: "keep"})

      assert {:ok, %{removed_event_id: removed_event_id}} =
               Chat.remove_timeline_chat_message(removed_event, host, %{})

      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id = global_id(:live_session, ended_session.id)
      removed_global_id = global_id(:chat_message_event, removed_event_id)
      kept_global_id = global_id(:chat_message_event, kept_event.id)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "__typename" => "ChatMessageEvent",
                            "id" => ^kept_global_id,
                            "body" => "keep"
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(timeline_event_node_query(), LCGQL.Schema,
                 variables: %{"id" => removed_global_id},
                 context: context
               )
    end

    test "returns edited chat messages once with the latest body and edit metadata" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(sender)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(live_session, sender, %{body: "helo"})

      assert {:ok, first_edit} =
               Chat.edit_timeline_chat_message(event, sender, %{body: "hello"})

      assert {:ok, second_edit} =
               Chat.edit_timeline_chat_message(event, sender, %{body: "hello!"})

      {:ok, ended_session} = Live.end_live_session(live_session)

      live_session_id = global_id(:live_session, ended_session.id)
      event_id = global_id(:chat_message_event, event.id)

      assert first_edit.id == event.id
      assert second_edit.id == event.id

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "__typename" => "ChatMessageEvent",
                            "id" => ^event_id,
                            "body" => "hello!",
                            "edited" => true,
                            "editCount" => 2,
                            "editedAt" => edited_at
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )

      assert is_binary(edited_at)
    end

    test "returns lifecycle events as concrete timeline event nodes" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, started_event} =
               Chat.record_lifecycle_timeline_event(live_session, :live_session_started,
                 actor: host
               )

      assert {:ok, chat_event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "between"})

      {:ok, ended_session} = Live.end_live_session(live_session)

      assert {:ok, ended_event} =
               Chat.record_lifecycle_timeline_event(ended_session, :live_session_ended,
                 actor: host
               )

      shared_time = ~U[2026-03-17 20:00:00.000000Z]
      set_timeline_event_timestamp(started_event, shared_time)
      set_timeline_event_timestamp(chat_event, DateTime.add(shared_time, 1, :second))
      set_timeline_event_timestamp(ended_event, DateTime.add(shared_time, 2, :second))

      live_session_id = global_id(:live_session, ended_session.id)
      started_id = global_id(:live_session_started_event, started_event.id)
      ended_id = global_id(:live_session_ended_event, ended_event.id)
      host_id = global_id(:user, host.id)

      assert {:ok,
              %{
                data: %{
                  "node" => %{
                    "timelineEvents" => %{
                      "edges" => [
                        %{
                          "node" => %{
                            "__typename" => "LiveSessionStartedEvent",
                            "id" => ^started_id,
                            "eventType" => "LIVE_SESSION_STARTED",
                            "actor" => %{"id" => ^host_id}
                          }
                        },
                        %{
                          "node" => %{
                            "__typename" => "ChatMessageEvent",
                            "body" => "between"
                          }
                        },
                        %{
                          "node" => %{
                            "__typename" => "LiveSessionEndedEvent",
                            "id" => ^ended_id,
                            "eventType" => "LIVE_SESSION_ENDED",
                            "actor" => %{"id" => ^host_id}
                          }
                        }
                      ]
                    }
                  }
                }
              }} =
               Absinthe.run(timeline_events_query(), LCGQL.Schema,
                 variables: %{"id" => live_session_id, "first" => 10},
                 context: context
               )
    end
  end

  defp timeline_events_query do
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
          timelineEvents(first: $first, after: $after, last: $last, before: $before) {
            edges {
              cursor
              node {
                __typename
                id
                eventType
                occurredAt
                actor { id }
                ... on ChatMessageEvent {
                  body
                  edited
                  editCount
                  editedAt
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

  defp timeline_event_node_query do
    """
    query($id: ID!) {
      node(id: $id) {
        id
        ... on ChatMessageEvent {
          body
        }
      }
    }
    """
  end

  defp global_id(type, id), do: Absinthe.Relay.Node.to_global_id(type, id, LCGQL.Schema)

  defp set_timeline_event_timestamp(%{id: event_id}, %DateTime{} = timestamp) do
    {1, nil} =
      Repo.update_all(from(event in LiveSessionTimelineEvent, where: event.id == ^event_id),
        set: [occurred_at: timestamp, updated_at: timestamp]
      )

    {1, nil} =
      Repo.update_all(
        from(event_state in LiveSessionTimelineEventState,
          where: event_state.timeline_event_id == ^event_id
        ),
        set: [occurred_at: timestamp, updated_at: timestamp]
      )
  end
end
