defmodule LCGQL.Accounts.AccountMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.UserToken
  alias LCSchemas.Infra.{AccountDeletionRequest, AsyncJob, DataExportRequest}

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
    test "normalizes and persists a phone number for the authenticated viewer" do
      user = user_fixture()
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(user)}

      mutation = """
      mutation {
        attachUserPhoneNumber(input: {phoneNumber: "(650) 253-0000"}) {
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
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert persisted_user = Accounts.get_user_by_phone("+1 650-253-0000")
      assert persisted_user.id == user.id
    end

    test "returns unauthenticated errors without a viewer scope" do
      mutation = """
      mutation {
        attachUserPhoneNumber(input: {phoneNumber: "(650) 253-0000"}) {
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
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "requestPasswordReset" do
    test "issues a password reset token when the email exists" do
      user = user_fixture()

      mutation = """
      mutation RequestPasswordReset($email: String!) {
        requestPasswordReset(input: {email: $email}) {
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok, %{data: %{"requestPasswordReset" => %{"errors" => []}}}} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"email" => user.email}
               )

      assert %UserToken{context: :password_reset_token, user_id: user_id} =
               Repo.one(
                 from(t in UserToken,
                   where: t.context == :password_reset_token,
                   order_by: [desc: t.inserted_at],
                   limit: 1
                 )
               )

      assert user_id == user.id
    end

    test "returns an empty error list when the email does not exist" do
      mutation = """
      mutation RequestPasswordReset($email: String!) {
        requestPasswordReset(input: {email: $email}) {
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok, %{data: %{"requestPasswordReset" => %{"errors" => []}}}} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"email" => "missing@example.com"}
               )

      assert Repo.aggregate(
               from(t in UserToken, where: t.context == :password_reset_token),
               :count,
               :id
             ) == 0
    end
  end

  describe "resetPassword" do
    test "resets password with a valid token" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_password_reset_token(user)

      mutation = """
      mutation ResetPassword($token: String!, $password: String!, $passwordConfirmation: String!) {
        resetPassword(
          input: {
            token: $token
            password: $password
            passwordConfirmation: $passwordConfirmation
          }
        ) {
          reset
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok, %{data: %{"resetPassword" => %{"reset" => true, "errors" => []}}}} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{
                   "token" => token,
                   "password" => "a valid new password",
                   "passwordConfirmation" => "a valid new password"
                 }
               )

      assert Accounts.get_user_by_email_and_password(user.email, "a valid new password")
    end

    test "returns an invalid_or_expired error when the token is invalid" do
      mutation = """
      mutation ResetPassword($token: String!, $password: String!, $passwordConfirmation: String!) {
        resetPassword(
          input: {
            token: $token
            password: $password
            passwordConfirmation: $passwordConfirmation
          }
        ) {
          reset
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
                  "resetPassword" => %{
                    "reset" => false,
                    "errors" => [%{"field" => nil, "message" => "invalid_or_expired"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{
                   "token" => "invalid-token",
                   "password" => "a valid new password",
                   "passwordConfirmation" => "a valid new password"
                 }
               )
    end

    test "returns changeset errors when the new password is invalid" do
      user = user_fixture()
      {:ok, %{token: token}} = Accounts.issue_password_reset_token(user)

      mutation = """
      mutation ResetPassword($token: String!, $password: String!, $passwordConfirmation: String!) {
        resetPassword(
          input: {
            token: $token
            password: $password
            passwordConfirmation: $passwordConfirmation
          }
        ) {
          reset
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
                  "resetPassword" => %{
                    "reset" => false,
                    "errors" => errors
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{
                   "token" => token,
                   "password" => "short",
                   "passwordConfirmation" => "mismatch"
                 }
               )

      assert Enum.any?(errors, &(&1["field"] == "password"))
      assert Enum.any?(errors, &(&1["field"] == "password_confirmation"))
    end
  end

  describe "requestViewerDataExport" do
    test "creates and dedupes a viewer-scoped export request" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        requestViewerDataExport(input: {}) {
          dataExportRequest {
            id
            status
            format
            requestedAt
            completedAt
            failureReason
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
                  "requestViewerDataExport" => %{
                    "dataExportRequest" => %{
                      "id" => request_id,
                      "status" => "PENDING",
                      "format" => "JSON",
                      "requestedAt" => requested_at,
                      "completedAt" => nil,
                      "failureReason" => nil
                    },
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert is_binary(request_id)
      assert is_binary(requested_at)

      assert {:ok, %{type: :data_export_request}} =
               Absinthe.Relay.Node.from_global_id(request_id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "requestViewerDataExport" => %{
                    "dataExportRequest" => %{"id" => ^request_id},
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert Repo.aggregate(DataExportRequest, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end

    test "returns a relay connection scoped to the viewer" do
      viewer = user_fixture()
      outsider = user_fixture()
      viewer_context = %{current_scope: Accounts.scope_for_user(viewer)}
      outsider_context = %{current_scope: Accounts.scope_for_user(outsider)}

      mutation = """
      mutation {
        requestViewerDataExport(input: {}) {
          dataExportRequest {
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
              %{data: %{"requestViewerDataExport" => %{"dataExportRequest" => %{"id" => id}}}}} =
               Absinthe.run(mutation, LCGQL.Schema, context: viewer_context)

      assert {:ok,
              %{data: %{"requestViewerDataExport" => %{"dataExportRequest" => %{"id" => _id}}}}} =
               Absinthe.run(mutation, LCGQL.Schema, context: outsider_context)

      query = """
      query($first: Int!) {
        viewerDataExportRequests(first: $first) {
          edges {
            node {
              id
              status
              format
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "viewerDataExportRequests" => %{
                    "edges" => [
                      %{
                        "node" => %{
                          "id" => ^id,
                          "status" => "PENDING",
                          "format" => "JSON"
                        }
                      }
                    ],
                    "pageInfo" => %{"hasNextPage" => false, "endCursor" => _end_cursor}
                  }
                }
              }} =
               Absinthe.run(
                 query,
                 LCGQL.Schema,
                 variables: %{"first" => 10},
                 context: viewer_context
               )
    end

    test "returns an unauthenticated error without a viewer scope" do
      mutation = """
      mutation {
        requestViewerDataExport(input: {}) {
          dataExportRequest {
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
                  "requestViewerDataExport" => %{
                    "dataExportRequest" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "requestViewerAccountDeletion and cancelViewerAccountDeletionRequest" do
    test "creates and dedupes a viewer-scoped account deletion request" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        requestViewerAccountDeletion(input: {}) {
          accountDeletionRequest {
            id
            status
            requestedAt
            scheduledPurgeAt
            completedAt
            failureReason
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
                  "requestViewerAccountDeletion" => %{
                    "accountDeletionRequest" => %{
                      "id" => request_id,
                      "status" => "SCHEDULED",
                      "requestedAt" => requested_at,
                      "scheduledPurgeAt" => scheduled_purge_at,
                      "completedAt" => nil,
                      "failureReason" => nil
                    },
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert is_binary(request_id)
      assert is_binary(requested_at)
      assert is_binary(scheduled_purge_at)

      assert {:ok, %{type: :account_deletion_request}} =
               Absinthe.Relay.Node.from_global_id(request_id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "requestViewerAccountDeletion" => %{
                    "accountDeletionRequest" => %{"id" => ^request_id},
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert Repo.aggregate(AccountDeletionRequest, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end

    test "cancels a viewer-scoped account deletion request once" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, request} =
               Accounts.request_user_account_deletion(viewer, grace_period_seconds: 3_600)

      request_id =
        Absinthe.Relay.Node.to_global_id(:account_deletion_request, request.id, LCGQL.Schema)

      cancel_mutation = """
      mutation CancelViewerAccountDeletionRequest($requestId: ID!) {
        cancelViewerAccountDeletionRequest(
          input: {accountDeletionRequestId: $requestId}
        ) {
          accountDeletionRequest {
            id
            status
            completedAt
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
                  "cancelViewerAccountDeletionRequest" => %{
                    "accountDeletionRequest" => %{
                      "id" => ^request_id,
                      "status" => "CANCELED",
                      "completedAt" => completed_at
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(cancel_mutation, LCGQL.Schema,
                 variables: %{"requestId" => request_id},
                 context: context
               )

      assert is_binary(completed_at)

      assert {:ok,
              %{
                data: %{
                  "cancelViewerAccountDeletionRequest" => %{
                    "accountDeletionRequest" => nil,
                    "errors" => [%{"field" => nil, "message" => "cannot_cancel"}]
                  }
                }
              }} =
               Absinthe.run(cancel_mutation, LCGQL.Schema,
                 variables: %{"requestId" => request_id},
                 context: context
               )
    end

    test "returns unauthenticated errors without a viewer scope" do
      mutation = """
      mutation {
        requestViewerAccountDeletion(input: {}) {
          accountDeletionRequest {
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
                  "requestViewerAccountDeletion" => %{
                    "accountDeletionRequest" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "unlinkViewerIdentity" do
    test "revokes a viewer-owned identity and returns the unlinked node" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      identity =
        attach_user_identity(viewer, :google_provider, "google-mutation-unlink-success")

      identity_id = Absinthe.Relay.Node.to_global_id(:user_identity, identity.id, LCGQL.Schema)

      mutation = """
      mutation UnlinkViewerIdentity($identityId: ID!) {
        unlinkViewerIdentity(input: {userIdentityId: $identityId}) {
          userIdentity {
            id
            provider
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
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => %{"id" => ^identity_id, "provider" => "google_provider"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"identityId" => identity_id},
                 context: context
               )

      refute Accounts.get_user_by_identity(:google_provider, "google-mutation-unlink-success")
    end

    test "returns structured errors for invalid or unowned identity IDs" do
      viewer = user_fixture()
      outsider = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      outsider_identity =
        attach_user_identity(outsider, :apple_provider, "apple-mutation-unlink-outsider")

      outsider_identity_id =
        Absinthe.Relay.Node.to_global_id(:user_identity, outsider_identity.id, LCGQL.Schema)

      wrong_type_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

      mutation = """
      mutation UnlinkViewerIdentity($identityId: ID!) {
        unlinkViewerIdentity(input: {userIdentityId: $identityId}) {
          userIdentity {
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
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => nil,
                    "errors" => [%{"field" => "userIdentityId", "message" => "is invalid"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"identityId" => wrong_type_id},
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => nil,
                    "errors" => [%{"field" => nil, "message" => "not_found"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"identityId" => outsider_identity_id},
                 context: context
               )
    end

    test "returns already_revoked when unlink is repeated for the same identity" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      identity =
        attach_user_identity(viewer, :google_provider, "google-mutation-unlink-repeat")

      identity_id = Absinthe.Relay.Node.to_global_id(:user_identity, identity.id, LCGQL.Schema)

      mutation = """
      mutation UnlinkViewerIdentity($identityId: ID!) {
        unlinkViewerIdentity(input: {userIdentityId: $identityId}) {
          userIdentity {
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
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => %{"id" => ^identity_id},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"identityId" => identity_id},
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => nil,
                    "errors" => [%{"field" => nil, "message" => "already_revoked"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"identityId" => identity_id},
                 context: context
               )
    end

    test "returns unauthenticated errors without a viewer scope" do
      viewer = user_fixture()

      identity =
        attach_user_identity(viewer, :google_provider, "google-mutation-unlink-anon")

      identity_id = Absinthe.Relay.Node.to_global_id(:user_identity, identity.id, LCGQL.Schema)

      mutation = """
      mutation UnlinkViewerIdentity($identityId: ID!) {
        unlinkViewerIdentity(input: {userIdentityId: $identityId}) {
          userIdentity {
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
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"identityId" => identity_id})
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
               "RequestPasswordResetPayload {\n  errors: [UserError!]!\n  successful: Boolean!"

      refute schema_sdl =~
               "ResetPasswordPayload {\n  reset: Boolean!\n  errors: [UserError!]!\n  successful: Boolean!"

      refute schema_sdl =~
               "DeliverViewerContactInvitePayload {\n  successful: Boolean!"

      refute schema_sdl =~
               "IssueViewerAuthTokensPayload {\n  accessToken: Token\n  refreshToken: Token\n  errors: [UserError!]!\n  successful: Boolean!"

      refute schema_sdl =~
               "RefreshAuthTokensPayload {\n  accessToken: Token\n  refreshToken: Token\n  errors: [UserError!]!\n  successful: Boolean!"

      refute schema_sdl =~
               "RevokeRefreshTokenPayload {\n  revoked: Boolean!\n  errors: [UserError!]!\n  successful: Boolean!"
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

  describe "issueViewerAuthTokens" do
    test "issues access and refresh tokens for the authenticated viewer" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        issueViewerAuthTokens(input: {}) {
          accessToken {
            serializedValue
            tokenVersion
          }
          refreshToken {
            serializedValue
            tokenVersion
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
                  "issueViewerAuthTokens" => %{
                    "accessToken" => %{
                      "serializedValue" => access_token,
                      "tokenVersion" => 1
                    },
                    "refreshToken" => %{
                      "serializedValue" => refresh_token,
                      "tokenVersion" => 1
                    },
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert {:ok, %{id: access_token_id}} = Accounts.Tokens.decode_serialized_value(access_token)

      assert {:ok, %{id: refresh_token_id}} =
               Accounts.Tokens.decode_serialized_value(refresh_token)

      assert %UserToken{context: :access_token} = Repo.get(UserToken, access_token_id)
      assert %UserToken{context: :refresh_token} = Repo.get(UserToken, refresh_token_id)
    end

    test "returns unauthenticated errors without a viewer scope" do
      mutation = """
      mutation {
        issueViewerAuthTokens(input: {}) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
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
                  "issueViewerAuthTokens" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "loginWithPassword" do
    test "issues access and refresh tokens for valid credentials" do
      user = user_fixture() |> set_password()

      mutation = """
      mutation LoginWithPassword($email: String!, $password: String!) {
        loginWithPassword(input: {email: $email, password: $password}) {
          accessToken {
            serializedValue
            tokenVersion
          }
          refreshToken {
            serializedValue
            tokenVersion
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
                  "loginWithPassword" => %{
                    "accessToken" => %{"serializedValue" => access_token, "tokenVersion" => 1},
                    "refreshToken" => %{"serializedValue" => refresh_token, "tokenVersion" => 1},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"email" => user.email, "password" => valid_user_password()}
               )

      assert {:ok, %{id: access_token_id}} = Accounts.Tokens.decode_serialized_value(access_token)

      assert {:ok, %{id: refresh_token_id}} =
               Accounts.Tokens.decode_serialized_value(refresh_token)

      assert %UserToken{context: :access_token} = Repo.get(UserToken, access_token_id)
      assert %UserToken{context: :refresh_token} = Repo.get(UserToken, refresh_token_id)
    end

    test "returns deterministic invalid-credential errors" do
      user = user_fixture() |> set_password()

      mutation = """
      mutation LoginWithPassword($email: String!, $password: String!) {
        loginWithPassword(input: {email: $email, password: $password}) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
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
                  "loginWithPassword" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [%{"field" => nil, "message" => "invalid_credentials"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"email" => user.email, "password" => "wrong-password"}
               )
    end
  end

  describe "requestMagicLinkLogin" do
    test "issues a magic-link token for existing users and returns an empty error list" do
      user = user_fixture()

      mutation = """
      mutation RequestMagicLinkLogin($email: String!) {
        requestMagicLinkLogin(input: {email: $email}) {
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
                  "requestMagicLinkLogin" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"email" => user.email})

      assert %UserToken{context: :email_magic_link_token} =
               Repo.get_by(UserToken, user_id: user.id, context: :email_magic_link_token)
    end

    test "does not enumerate missing emails and does not issue tokens" do
      mutation = """
      mutation RequestMagicLinkLogin($email: String!) {
        requestMagicLinkLogin(input: {email: $email}) {
          errors {
            field
            message
          }
        }
      }
      """

      before_count = Repo.aggregate(UserToken, :count, :id)

      assert {:ok,
              %{
                data: %{
                  "requestMagicLinkLogin" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"email" => "missing-user@example.com"}
               )

      after_count = Repo.aggregate(UserToken, :count, :id)
      assert after_count == before_count
    end
  end

  describe "loginWithMagicLink" do
    test "consumes a magic-link token and issues access/refresh tokens" do
      user = user_fixture()
      {magic_link_token, _hashed_token} = generate_user_magic_link_token(user)

      mutation = """
      mutation LoginWithMagicLink($token: String!) {
        loginWithMagicLink(input: {token: $token}) {
          accessToken {
            serializedValue
            tokenVersion
          }
          refreshToken {
            serializedValue
            tokenVersion
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
                  "loginWithMagicLink" => %{
                    "accessToken" => %{"serializedValue" => access_token, "tokenVersion" => 1},
                    "refreshToken" => %{"serializedValue" => refresh_token, "tokenVersion" => 1},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"token" => magic_link_token}
               )

      assert {:error, :not_found} = Accounts.login_user_by_magic_link(magic_link_token)

      assert {:ok, %{user: %{id: viewer_id}}} = Accounts.authenticate_access_token(access_token)
      assert viewer_id == user.id

      assert {:ok, %{user: %{id: refresh_user_id}}} =
               Accounts.authenticate_refresh_token(refresh_token)

      assert refresh_user_id == user.id
    end

    test "returns invalid_or_expired for unusable magic-link tokens" do
      mutation = """
      mutation LoginWithMagicLink($token: String!) {
        loginWithMagicLink(input: {token: $token}) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
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
                  "loginWithMagicLink" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [%{"field" => nil, "message" => "invalid_or_expired"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"token" => "invalid-token"})
    end
  end

  describe "refreshAuthTokens" do
    test "rotates a refresh token into a fresh access and refresh pair" do
      viewer = user_fixture()
      {:ok, %{token: previous_refresh_token}} = Accounts.issue_refresh_token(viewer)

      mutation = """
      mutation RefreshAuthTokens($refreshToken: String!) {
        refreshAuthTokens(input: {refreshToken: $refreshToken}) {
          accessToken {
            serializedValue
            tokenVersion
          }
          refreshToken {
            serializedValue
            tokenVersion
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
                  "refreshAuthTokens" => %{
                    "accessToken" => %{
                      "serializedValue" => new_access_token,
                      "tokenVersion" => 1
                    },
                    "refreshToken" => %{
                      "serializedValue" => new_refresh_token,
                      "tokenVersion" => 1
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"refreshToken" => previous_refresh_token}
               )

      assert {:error, :revoked_token} =
               Accounts.authenticate_refresh_token(previous_refresh_token)

      assert {:ok, %{user: %{id: viewer_id}}} =
               Accounts.authenticate_access_token(new_access_token)

      assert {:ok, %{user: %{id: ^viewer_id}}} =
               Accounts.authenticate_refresh_token(new_refresh_token)

      assert viewer_id == viewer.id
    end

    test "returns invalid_token errors for malformed token values" do
      mutation = """
      mutation {
        refreshAuthTokens(input: {refreshToken: "not-a-token"}) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
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
                  "refreshAuthTokens" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [%{"field" => "refreshToken", "message" => "invalid_token"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end

    test "returns expired_token errors for expired refresh tokens" do
      viewer = user_fixture()
      {:ok, %{token: refresh_token}} = Accounts.issue_refresh_token(viewer)
      offset_user_token(refresh_token, -31, :day)

      mutation = """
      mutation RefreshAuthTokens($refreshToken: String!) {
        refreshAuthTokens(input: {refreshToken: $refreshToken}) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
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
                  "refreshAuthTokens" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [%{"field" => "refreshToken", "message" => "expired_token"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"refreshToken" => refresh_token}
               )
    end

    test "returns revoked_token errors for revoked refresh tokens" do
      viewer = user_fixture()
      {:ok, %{token: refresh_token}} = Accounts.issue_refresh_token(viewer)
      :ok = Accounts.revoke_refresh_token(refresh_token)

      mutation = """
      mutation RefreshAuthTokens($refreshToken: String!) {
        refreshAuthTokens(input: {refreshToken: $refreshToken}) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
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
                  "refreshAuthTokens" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [%{"field" => "refreshToken", "message" => "revoked_token"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"refreshToken" => refresh_token}
               )
    end
  end

  describe "revokeRefreshToken" do
    test "revokes refresh tokens idempotently" do
      viewer = user_fixture()
      {:ok, %{token: refresh_token}} = Accounts.issue_refresh_token(viewer)

      mutation = """
      mutation RevokeRefreshToken($refreshToken: String!) {
        revokeRefreshToken(input: {refreshToken: $refreshToken}) {
          revoked
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
                  "revokeRefreshToken" => %{
                    "revoked" => true,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"refreshToken" => refresh_token}
               )

      assert {:ok,
              %{
                data: %{
                  "revokeRefreshToken" => %{
                    "revoked" => true,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"refreshToken" => refresh_token}
               )

      assert {:error, :revoked_token} = Accounts.authenticate_refresh_token(refresh_token)
    end
  end
end
