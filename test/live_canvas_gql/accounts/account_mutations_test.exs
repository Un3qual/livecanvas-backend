defmodule LCGQL.Accounts.AccountMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.UserToken

  describe "registerWithEmail" do
    test "creates a user through the accounts boundary" do
      mutation = """
      mutation {
        registerWithEmail(input: {email: "user@example.com"}) {
          user {
            id
            email
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
                  "registerWithEmail" => %{
                    "user" => %{"id" => user_id, "email" => "user@example.com"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema)

      assert is_binary(user_id)
      assert user = Accounts.get_user_by_email("user@example.com")
      assert user.email == "user@example.com"
    end

    test "returns structured errors when the email is already taken" do
      _user = user_fixture(%{email: "duplicate@example.com"})

      mutation = """
      mutation {
        registerWithEmail(input: {email: "duplicate@example.com"}) {
          user {
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
                  "registerWithEmail" => %{
                    "user" => nil,
                    "errors" => [%{"field" => "email", "message" => _message} | _]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "attachUserPhoneNumber" do
    test "normalizes and persists a phone number through the accounts boundary" do
      user = user_fixture()
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      mutation = """
      mutation($userId: ID!) {
        attachUserPhoneNumber(input: {userId: $userId, phoneNumber: "(650) 253-0000"}) {
          user {
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
                  "attachUserPhoneNumber" => %{
                    "user" => %{"id" => ^user_id},
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"userId" => user_id})

      assert persisted_user = Accounts.get_user_by_phone("+1 650-253-0000")
      assert persisted_user.id == user.id
    end

    test "rejects a raw numeric userId that is not a relay global id" do
      user = user_fixture()

      mutation = """
      mutation($userId: ID!) {
        attachUserPhoneNumber(input: {userId: $userId, phoneNumber: "(650) 253-0000"}) {
          user {
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
                  "attachUserPhoneNumber" => %{
                    "user" => nil,
                    "errors" => [%{"field" => "userId", "message" => _message} | _]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"userId" => "#{user.id}"})
    end
  end

  describe "schema cleanup" do
    test "does not expose the legacy appleAuthenticate stub" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "appleAuthenticate"

      refute schema_sdl =~
               "RegisterWithEmailPayload {\n  user: User\n  errors: [UserError!]!\n  successful: Boolean!"

      refute schema_sdl =~
               "AttachUserPhoneNumberPayload {\n  user: User\n  errors: [UserError!]!\n  successful: Boolean!"

      refute schema_sdl =~
               "DeliverViewerContactInvitePayload {\n  successful: Boolean!"
    end
  end

  describe "upsertViewerContactEntry" do
    test "creates and then updates a viewer-owned contact entry with stable relay node identity" do
      viewer = user_fixture()
      matched_user = user_fixture()
      second_matched_user = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation UpsertViewerContactEntry(
        $contactClientId: String!
        $contactName: String
        $birthday: String
        $emails: [String!]
        $phoneNumbers: [String!]
      ) {
        upsertViewerContactEntry(
          input: {
            contactClientId: $contactClientId
            contactName: $contactName
            birthday: $birthday
            emails: $emails
            phoneNumbers: $phoneNumbers
          }
        ) {
          contactMatch {
            id
            contactName
            birthday
            matchedUsers {
              id
              email
            }
          }
          errors {
            field
            message
          }
        }
      }
      """

      variables = %{
        "contactClientId" => "ios-address-book-1",
        "contactName" => "First Import",
        "birthday" => "1990-02-15",
        "emails" => [matched_user.email],
        "phoneNumbers" => []
      }

      assert {:ok,
              %{
                data: %{
                  "upsertViewerContactEntry" => %{
                    "contactMatch" => %{
                      "id" => first_contact_match_id,
                      "contactName" => "First Import",
                      "birthday" => "1990-02-15",
                      "matchedUsers" => [%{"id" => matched_user_id, "email" => matched_email}]
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: variables, context: context)

      assert matched_email == matched_user.email

      assert {:ok, %{type: :contact_match}} =
               Absinthe.Relay.Node.from_global_id(first_contact_match_id, LCGQL.Schema)

      assert {:ok, %{type: :user}} =
               Absinthe.Relay.Node.from_global_id(matched_user_id, LCGQL.Schema)

      updated_variables = %{
        "contactClientId" => "ios-address-book-1",
        "contactName" => "Updated Import",
        "birthday" => "1991-03-01",
        "emails" => [second_matched_user.email],
        "phoneNumbers" => []
      }

      expected_second_user_id =
        Absinthe.Relay.Node.to_global_id(:user, second_matched_user.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "upsertViewerContactEntry" => %{
                    "contactMatch" => %{
                      "id" => ^first_contact_match_id,
                      "contactName" => "Updated Import",
                      "birthday" => "1991-03-01",
                      "matchedUsers" => [
                        %{
                          "id" => ^expected_second_user_id,
                          "email" => second_matched_user_email
                        }
                      ]
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: updated_variables,
                 context: context
               )

      assert second_matched_user_email == second_matched_user.email
    end

    test "returns structured errors for invalid input payload values" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        upsertViewerContactEntry(
          input: {
            contactClientId: "ios-address-book-2"
            birthday: "not-a-date"
            emails: ["friend@example.com"]
            phoneNumbers: []
          }
        ) {
          contactMatch {
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
                  "upsertViewerContactEntry" => %{
                    "contactMatch" => nil,
                    "errors" => [%{"field" => "birthday", "message" => "is invalid"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)
    end

    test "returns an unauthenticated error without a viewer scope" do
      mutation = """
      mutation {
        upsertViewerContactEntry(
          input: {
            contactClientId: "ios-address-book-3"
            contactName: "No Viewer"
            emails: []
            phoneNumbers: []
          }
        ) {
          contactMatch {
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
                  "upsertViewerContactEntry" => %{
                    "contactMatch" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "deliverViewerContactInvite" do
    test "delivers an invite for the authenticated viewer and persists a contact invite token" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation DeliverViewerContactInvite($recipient: String!) {
        deliverViewerContactInvite(input: {recipient: $recipient}) {
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
                  "deliverViewerContactInvite" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"recipient" => "Friend@Example.com"},
                 context: context
               )

      assert %UserToken{} =
               user_token =
               Repo.get_by(UserToken, user_id: viewer.id, context: :contact_invite_token)

      assert user_token.sent_to == "friend@example.com"
    end

    test "returns structured errors for invalid recipient values" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        deliverViewerContactInvite(input: {recipient: "   "}) {
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
                  "deliverViewerContactInvite" => %{
                    "errors" => [%{"field" => "recipient", "message" => "is invalid"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)
    end

    test "does not persist invite tokens when the recipient is invalid" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        deliverViewerContactInvite(input: {recipient: "invalid-recipient"}) {
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
                  "deliverViewerContactInvite" => %{
                    "errors" => [%{"field" => "recipient", "message" => "is invalid"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      refute Repo.get_by(UserToken, user_id: viewer.id, context: :contact_invite_token)
    end

    test "returns an unauthenticated error without a viewer scope" do
      mutation = """
      mutation {
        deliverViewerContactInvite(input: {recipient: "friend@example.com"}) {
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
                  "deliverViewerContactInvite" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end
end
