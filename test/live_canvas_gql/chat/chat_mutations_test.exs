defmodule LCGQL.Chat.ChatMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Chat, Live}

  describe "editLiveChatMessage" do
    test "allows the original actor to edit an active chat message event" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(sender)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(live_session, sender, %{body: "helo"})

      event_id = global_id(:chat_message_event, event.id)

      assert {:ok,
              %{
                data: %{
                  "editLiveChatMessage" => %{
                    "chatMessageEvent" => %{
                      "id" => ^event_id,
                      "body" => "hello",
                      "edited" => true,
                      "editCount" => 1,
                      "editedAt" => edited_at
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(edit_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id, "body" => "hello"},
                 context: context
               )

      assert is_binary(edited_at)

      assert %{body: "hello", edited: true, edit_count: 1} =
               Chat.get_timeline_event(sender, event.id)
    end

    test "rejects edits from a different actor" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      other = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(other)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(live_session, sender, %{body: "mine"})

      event_id = global_id(:chat_message_event, event.id)

      assert {:ok,
              %{
                data: %{
                  "editLiveChatMessage" => %{
                    "chatMessageEvent" => nil,
                    "errors" => [%{"message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(edit_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id, "body" => "stolen"},
                 context: context
               )
    end

    test "maps invalid global ID types to a chatMessageEventId validation error" do
      actor = user_fixture(privacy_mode: :public)
      {:ok, live_session} = Live.start_live_session(actor, %{visibility: :public})
      context = %{current_scope: Accounts.scope_for_user(actor)}
      live_session_id = global_id(:live_session, live_session.id)

      assert {:ok,
              %{
                data: %{
                  "editLiveChatMessage" => %{
                    "chatMessageEvent" => nil,
                    "errors" => [
                      %{"field" => "chatMessageEventId", "message" => "is invalid"}
                    ]
                  }
                }
              }} =
               Absinthe.run(edit_message_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => live_session_id, "body" => "invalid"},
                 context: context
               )
    end
  end

  describe "removeLiveChatMessageEvent" do
    test "allows the session host to remove a viewer-authored chat message event" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(host)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(live_session, sender, %{body: "abusive"})

      event_id = global_id(:chat_message_event, event.id)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => %{
                    "removedTimelineEventId" => ^event_id,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id},
                 context: context
               )

      assert Chat.get_timeline_event(sender, event.id) == nil
    end

    test "rejects removal by non-hosts" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(sender)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(live_session, sender, %{body: "mine"})
      event_id = global_id(:chat_message_event, event.id)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => %{
                    "removedTimelineEventId" => nil,
                    "errors" => [%{"message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id},
                 context: context
               )
    end

    test "rejects removal by a host from another live session" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      outsider = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(outsider)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _outsider_session} = Live.start_live_session(outsider, %{visibility: :public})
      {:ok, event} = Chat.create_timeline_chat_message(live_session, sender, %{body: "private"})
      event_id = global_id(:chat_message_event, event.id)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => %{
                    "removedTimelineEventId" => nil,
                    "errors" => [%{"message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id},
                 context: context
               )
    end

    test "returns the same public error for hidden and missing event IDs" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(host)}
      non_host_context = %{current_scope: Accounts.scope_for_user(sender)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      {:ok, event} =
        Chat.create_timeline_chat_message(live_session, sender, %{body: "remove once"})

      event_id = global_id(:chat_message_event, event.id)
      missing_event_id = global_id(:chat_message_event, event.id + 10_000_000)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => %{
                    "removedTimelineEventId" => ^event_id,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id},
                 context: context
               )

      expected_not_found_payload = %{
        "removedTimelineEventId" => nil,
        "errors" => [%{"field" => nil, "message" => "not_found"}]
      }

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => ^expected_not_found_payload
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => event_id},
                 context: non_host_context
               )

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => ^expected_not_found_payload
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => missing_event_id},
                 context: non_host_context
               )

      assert {:ok, %{data: %{"node" => nil}}} =
               Absinthe.run(timeline_event_node_query(), LCGQL.Schema,
                 variables: %{"id" => event_id},
                 context: context
               )
    end

    test "maps invalid global ID types to a chatMessageEventId validation error" do
      actor = user_fixture(privacy_mode: :public)
      {:ok, live_session} = Live.start_live_session(actor, %{visibility: :public})
      context = %{current_scope: Accounts.scope_for_user(actor)}
      live_session_id = global_id(:live_session, live_session.id)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => %{
                    "removedTimelineEventId" => nil,
                    "errors" => [
                      %{"field" => "chatMessageEventId", "message" => "is invalid"}
                    ]
                  }
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => live_session_id},
                 context: context
               )
    end

    test "maps lifecycle event IDs to a chatMessageEventId validation error" do
      host = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(host)}
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, started_event} =
               Chat.record_lifecycle_timeline_event(live_session, :live_session_started,
                 actor: host
               )

      started_event_id = global_id(:live_session_started_event, started_event.id)

      assert {:ok,
              %{
                data: %{
                  "removeLiveChatMessageEvent" => %{
                    "removedTimelineEventId" => nil,
                    "errors" => [
                      %{"field" => "chatMessageEventId", "message" => "is invalid"}
                    ]
                  }
                }
              }} =
               Absinthe.run(remove_message_event_mutation(), LCGQL.Schema,
                 variables: %{"chatMessageEventId" => started_event_id},
                 context: context
               )
    end
  end

  defp edit_message_mutation do
    """
    mutation($chatMessageEventId: ID!, $body: String!) {
      editLiveChatMessage(input: { chatMessageEventId: $chatMessageEventId, body: $body }) {
        chatMessageEvent {
          id
          body
          edited
          editCount
          editedAt
        }
        errors {
          field
          message
        }
      }
    }
    """
  end

  defp remove_message_event_mutation do
    """
    mutation($chatMessageEventId: ID!) {
      removeLiveChatMessageEvent(input: { chatMessageEventId: $chatMessageEventId }) {
        removedTimelineEventId
        errors {
          field
          message
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
end
