defmodule LCGQL.Chat.ChatMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Chat, Live}

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
