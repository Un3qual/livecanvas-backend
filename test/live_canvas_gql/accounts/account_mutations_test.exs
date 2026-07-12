defmodule LCGQL.Accounts.AccountMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.PasskeyTestSupport
  import LC.ProviderAuthTestSupport
  import Swoosh.TestAssertions

  alias LC.{Accounts, Social}
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
                    "user" => %{"id" => user_id, "email" => nil},
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

  describe "updateViewerPrivacyMode" do
    test "updates privacy mode for the authenticated viewer" do
      user = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(user)}
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      mutation = """
      mutation {
        updateViewerPrivacyMode(input: {privacyMode: PUBLIC}) {
          user {
            id
            privacyMode
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
                  "updateViewerPrivacyMode" => %{
                    "user" => %{"id" => ^user_id, "privacyMode" => "PUBLIC"},
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert Accounts.get_user!(user.id).privacy_mode == :public
    end

    test "returns unauthenticated errors without a viewer scope" do
      mutation = """
      mutation {
        updateViewerPrivacyMode(input: {privacyMode: PUBLIC}) {
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
                  "updateViewerPrivacyMode" => %{
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
      viewer = user_fixture() |> set_password()
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

    test "rejects unlinking the last sign-in method for a passwordless viewer" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      identity = attach_user_identity(viewer, :google_provider, "google-mutation-last-sign-in")
      identity_id = Absinthe.Relay.Node.to_global_id(:user_identity, identity.id, LCGQL.Schema)

      mutation = """
      mutation UnlinkViewerIdentity($identityId: ID!) {
        unlinkViewerIdentity(input: {userIdentityId: $identityId}) {
          userIdentity { id }
          errors { field message }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "unlinkViewerIdentity" => %{
                    "userIdentity" => nil,
                    "errors" => [%{"field" => nil, "message" => "last_sign_in_method"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 variables: %{"identityId" => identity_id},
                 context: context
               )

      assert Accounts.get_active_user_identity(viewer, identity.id)
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
      viewer = user_fixture() |> set_password()
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

    test "exposes only the supported GraphQL auth entry points" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      assert schema_sdl =~ "beginAuthChallenge"
      assert schema_sdl =~ "signUp"
      assert schema_sdl =~ "logIn"
      assert schema_sdl =~ "refreshAuthTokens"
      assert schema_sdl =~ "revokeRefreshToken"

      refute schema_sdl =~ "loginWithPassword"
      refute schema_sdl =~ "requestMagicLinkLogin"
      refute schema_sdl =~ "loginWithMagicLink"
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
                      "matchedUsers" => [%{"id" => matched_user_id, "email" => nil}]
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: variables, context: context)

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
                          "email" => nil
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
    end

    test "omits a matched user who blocked the viewer from the mutation payload" do
      viewer = user_fixture()
      hidden_match = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, _block} = Social.block_user(hidden_match, viewer)

      mutation = """
      mutation($email: String!) {
        upsertViewerContactEntry(
          input: {
            contactClientId: "hidden-contact"
            emails: [$email]
            phoneNumbers: []
          }
        ) {
          contactMatch {
            matchedUsers {
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

      assert {:ok,
              %{
                data: %{
                  "upsertViewerContactEntry" => %{
                    "contactMatch" => %{"matchedUsers" => []},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"email" => hidden_match.email},
                 context: context
               )
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
    setup do
      previous_origin = Application.fetch_env!(:live_canvas, :public_app_origin)

      on_exit(fn ->
        Application.put_env(:live_canvas, :public_app_origin, previous_origin)
      end)

      :ok
    end

    test "places the percent-encoded invite token only in the configured HTTPS URL fragment" do
      viewer = user_fixture()
      assert_receive {:email, _login_email}
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

      for configured_origin <- [
            "https://app.livecanvas.example",
            "https://app.livecanvas.example/"
          ] do
        Application.put_env(:live_canvas, :public_app_origin, configured_origin)

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

        assert_email_sent(fn email ->
          [delivery_url] = Regex.run(~r{https://\S+/invites#token=\S+}, email.text_body)
          uri = URI.parse(delivery_url)

          assert delivery_url =~ ~r{^https://app\.livecanvas\.example/invites#token=}
          assert uri.scheme == "https"
          assert uri.host == "app.livecanvas.example"
          assert uri.path == "/invites"
          assert uri.query == nil
          assert uri.userinfo == nil
          assert uri.fragment =~ ~r/^token=[A-Za-z0-9._~-]+$/

          assert %{"token" => raw_token} = URI.decode_query(uri.fragment)
          refute URI.to_string(%{uri | fragment: nil}) =~ raw_token

          true
        end)
      end
    end

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

  describe "beginAuthChallenge" do
    test "returns structured auth errors for providers that do not use challenge issuance" do
      mutation = """
      mutation {
        beginAuthChallenge(input: {provider: PASSWORD, purpose: LOG_IN}) {
          challenge {
            provider
            purpose
            dispatched
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "beginAuthChallenge" => %{
                    "challenge" => nil,
                    "errors" => [
                      %{
                        "field" => "provider",
                        "code" => "UNSUPPORTED_PROVIDER",
                        "message" => "unsupported_provider"
                      }
                    ]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end

    test "issues a magic-link signup challenge for a new email" do
      email = unique_user_email()

      mutation = """
      mutation BeginAuthChallenge($email: String!) {
        beginAuthChallenge(
          input: {
            provider: MAGIC_LINK
            purpose: SIGN_UP
            magicLink: {email: $email}
          }
        ) {
          challenge {
            provider
            purpose
            dispatched
            challengeToken
            payloadJson
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "beginAuthChallenge" => %{
                    "challenge" => %{
                      "provider" => "MAGIC_LINK",
                      "purpose" => "SIGN_UP",
                      "dispatched" => true,
                      "challengeToken" => nil,
                      "payloadJson" => nil
                    },
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"email" => email})

      assert user = Accounts.get_user_by_email(email)

      assert %UserToken{context: :email_magic_link_token, user_id: user_id, sent_to: ^email} =
               Repo.one(
                 from(t in UserToken,
                   where: t.context == :email_magic_link_token and t.sent_to == ^email,
                   order_by: [desc: t.inserted_at],
                   limit: 1
                 )
               )

      assert user_id == user.id
    end

    test "keeps missing magic-link login emails enumeration-safe" do
      mutation = """
      mutation BeginAuthChallenge($email: String!) {
        beginAuthChallenge(
          input: {
            provider: MAGIC_LINK
            purpose: LOG_IN
            magicLink: {email: $email}
          }
        ) {
          challenge {
            provider
            purpose
            dispatched
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "beginAuthChallenge" => %{
                    "challenge" => %{
                      "provider" => "MAGIC_LINK",
                      "purpose" => "LOG_IN",
                      "dispatched" => true
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"email" => "missing-graphql-login@example.com"}
               )

      assert Repo.aggregate(
               from(t in UserToken, where: t.context == :email_magic_link_token),
               :count,
               :id
             ) == 0
    end

    test "issues a passkey signup challenge and returns challenge metadata" do
      email = unique_user_email()

      mutation = """
      mutation BeginAuthChallenge($email: String!) {
        beginAuthChallenge(
          input: {
            provider: PASSKEY
            purpose: SIGN_UP
            passkey: {email: $email}
          }
        ) {
          challenge {
            provider
            purpose
            dispatched
            challengeToken
            payloadJson
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      with_fake_passkey_adapter(fn ->
        assert {:ok,
                %{
                  data: %{
                    "beginAuthChallenge" => %{
                      "challenge" => %{
                        "provider" => "PASSKEY",
                        "purpose" => "SIGN_UP",
                        "dispatched" => true,
                        "challengeToken" => challenge_token,
                        "payloadJson" => payload_json
                      },
                      "errors" => []
                    }
                  }
                }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"email" => email})

        assert is_binary(challenge_token)
        assert %{"rp" => %{"id" => "livecanvas.invalid"}} = Jason.decode!(payload_json)
      end)
    end
  end

  describe "signUp" do
    test "returns auth error codes for invalid password signup input" do
      mutation = """
      mutation {
        signUp(
          input: {
            provider: PASSWORD
            password: {
              email: "signup@example.com"
              password: "a valid new password"
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "signUp" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [
                      %{
                        "field" => "password.passwordConfirmation",
                        "code" => "INVALID_INPUT",
                        "message" => "is required"
                      }
                    ]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end

    test "creates a password account and returns auth tokens" do
      email = unique_user_email()
      password = valid_user_password()

      mutation = """
      mutation SignUp($email: String!, $password: String!, $passwordConfirmation: String!) {
        signUp(
          input: {
            provider: PASSWORD
            password: {
              email: $email
              password: $password
              passwordConfirmation: $passwordConfirmation
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "signUp" => %{
                    "accessToken" => %{"serializedValue" => access_token},
                    "refreshToken" => %{"serializedValue" => refresh_token},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{
                   "email" => email,
                   "password" => password,
                   "passwordConfirmation" => password
                 }
               )

      assert is_binary(access_token)
      assert is_binary(refresh_token)
      assert user = Accounts.get_user_by_email(email)
      refute is_nil(user.hashed_password)
    end

    test "redeems a magic-link signup token into auth tokens" do
      user = unconfirmed_user_fixture(%{email: "graphql-magic-signup@example.com"})
      {token, _secret_hash} = generate_user_magic_link_token(user)

      mutation = """
      mutation SignUp($token: String!) {
        signUp(
          input: {
            provider: MAGIC_LINK
            magicLink: {token: $token}
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "signUp" => %{
                    "accessToken" => %{"serializedValue" => _access_token},
                    "refreshToken" => %{"serializedValue" => _refresh_token},
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"token" => token})

      assert Accounts.get_user_by_email(user.email).confirmed_at
    end

    test "creates a Google account from a verified provider token" do
      bundle = provider_token_bundle(:google)

      mutation = """
      mutation SignUp($idToken: String!) {
        signUp(
          input: {
            provider: GOOGLE
            oauth: {idToken: $idToken}
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      with_provider_configs([google: bundle.config], fn ->
        assert {:ok,
                %{
                  data: %{
                    "signUp" => %{
                      "accessToken" => %{"serializedValue" => _access_token},
                      "refreshToken" => %{"serializedValue" => _refresh_token},
                      "errors" => []
                    }
                  }
                }} =
                 Absinthe.run(mutation, LCGQL.Schema, variables: %{"idToken" => bundle.token})
      end)

      assert user = Accounts.get_user_by_email(bundle.claims["email"])
      assert Accounts.get_user_by_identity(:google_provider, bundle.claims["sub"]).id == user.id
      assert user.confirmed_at
    end

    test "creates a passkey account and returns auth tokens" do
      email = unique_user_email()

      begin_mutation = """
      mutation BeginAuthChallenge($email: String!) {
        beginAuthChallenge(
          input: {
            provider: PASSKEY
            purpose: SIGN_UP
            passkey: {email: $email}
          }
        ) {
          challenge {
            challengeToken
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      mutation = """
      mutation SignUp($challengeToken: String!, $credentialId: String!, $clientDataJson: String!, $attestationObject: String!) {
        signUp(
          input: {
            provider: PASSKEY
            passkey: {
              challengeToken: $challengeToken
              credentialId: $credentialId
              clientDataJson: $clientDataJson
              attestationObject: $attestationObject
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      with_fake_passkey_adapter(fn ->
        assert {:ok,
                %{
                  data: %{
                    "beginAuthChallenge" => %{
                      "challenge" => %{"challengeToken" => challenge_token}
                    }
                  }
                }} =
                 Absinthe.run(begin_mutation, LCGQL.Schema, variables: %{"email" => email})

        registration_input =
          registration_passkey_input(challenge_token, credential_id: "graphql-signup-passkey")

        assert {:ok,
                %{
                  data: %{
                    "signUp" => %{
                      "accessToken" => %{"serializedValue" => _access_token},
                      "refreshToken" => %{"serializedValue" => _refresh_token},
                      "errors" => []
                    }
                  }
                }} =
                 Absinthe.run(mutation, LCGQL.Schema,
                   variables: %{
                     "challengeToken" => challenge_token,
                     "credentialId" => "graphql-signup-passkey",
                     "clientDataJson" => registration_input.client_data_json,
                     "attestationObject" => registration_input.attestation_object
                   }
                 )
      end)
    end
  end

  describe "logIn" do
    test "returns auth error codes for invalid magic-link login input" do
      mutation = """
      mutation {
        logIn(
          input: {
            provider: MAGIC_LINK
            magicLink: {
              email: "viewer@example.com"
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "logIn" => %{
                    "accessToken" => nil,
                    "refreshToken" => nil,
                    "errors" => [
                      %{
                        "field" => "magicLink.token",
                        "code" => "INVALID_INPUT",
                        "message" => "is required"
                      }
                    ]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end

    test "logs in with password and returns auth tokens" do
      user = user_fixture(%{email: "graphql-password-login@example.com"}) |> set_password()
      password = valid_user_password()

      mutation = """
      mutation LogIn($email: String!, $password: String!) {
        logIn(
          input: {
            provider: PASSWORD
            password: {
              email: $email
              password: $password
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "logIn" => %{
                    "accessToken" => %{"serializedValue" => _access_token},
                    "refreshToken" => %{"serializedValue" => _refresh_token},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"email" => user.email, "password" => password}
               )
    end

    test "redeems a magic-link login token into auth tokens" do
      user = user_fixture(%{email: "graphql-magic-login@example.com"})
      {token, _secret_hash} = generate_user_magic_link_token(user)

      mutation = """
      mutation LogIn($token: String!) {
        logIn(
          input: {
            provider: MAGIC_LINK
            magicLink: {token: $token}
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "logIn" => %{
                    "accessToken" => %{"serializedValue" => _access_token},
                    "refreshToken" => %{"serializedValue" => _refresh_token},
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"token" => token})
    end

    test "returns provider_verification_failed when a provider token has no linked identity" do
      bundle = provider_token_bundle(:apple)
      _user = user_fixture(%{email: bundle.claims["email"]})

      mutation = """
      mutation LogIn($idToken: String!) {
        logIn(
          input: {
            provider: APPLE
            oauth: {idToken: $idToken}
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      with_provider_configs([apple: bundle.config], fn ->
        assert {:ok,
                %{
                  data: %{
                    "logIn" => %{
                      "accessToken" => nil,
                      "refreshToken" => nil,
                      "errors" => [
                        %{
                          "field" => "oauth.idToken",
                          "code" => "PROVIDER_VERIFICATION_FAILED",
                          "message" => "provider_verification_failed"
                        }
                      ]
                    }
                  }
                }} =
                 Absinthe.run(mutation, LCGQL.Schema, variables: %{"idToken" => bundle.token})
      end)
    end

    test "logs in with Apple and returns auth tokens for an existing linked identity" do
      bundle = provider_token_bundle(:apple)
      user = user_fixture(%{email: bundle.claims["email"]})

      _identity =
        attach_user_identity(user, :apple_provider, bundle.claims["sub"],
          provider_data: %{"email" => bundle.claims["email"]}
        )

      mutation = """
      mutation LogIn($idToken: String!) {
        logIn(
          input: {
            provider: APPLE
            oauth: {idToken: $idToken}
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      with_provider_configs([apple: bundle.config], fn ->
        assert {:ok,
                %{
                  data: %{
                    "logIn" => %{
                      "accessToken" => %{"serializedValue" => _access_token},
                      "refreshToken" => %{"serializedValue" => _refresh_token},
                      "errors" => []
                    }
                  }
                }} =
                 Absinthe.run(mutation, LCGQL.Schema, variables: %{"idToken" => bundle.token})
      end)
    end

    test "logs in with passkey and returns auth tokens" do
      email = unique_user_email()

      begin_sign_up_mutation = """
      mutation BeginSignUp($email: String!) {
        beginAuthChallenge(
          input: {
            provider: PASSKEY
            purpose: SIGN_UP
            passkey: {email: $email}
          }
        ) {
          challenge {
            challengeToken
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      sign_up_mutation = """
      mutation SignUp($challengeToken: String!, $credentialId: String!, $clientDataJson: String!, $attestationObject: String!) {
        signUp(
          input: {
            provider: PASSKEY
            passkey: {
              challengeToken: $challengeToken
              credentialId: $credentialId
              clientDataJson: $clientDataJson
              attestationObject: $attestationObject
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      begin_login_mutation = """
      mutation BeginLogIn($email: String!) {
        beginAuthChallenge(
          input: {
            provider: PASSKEY
            purpose: LOG_IN
            passkey: {email: $email}
          }
        ) {
          challenge {
            challengeToken
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      log_in_mutation = """
      mutation LogIn($challengeToken: String!, $credentialId: String!, $clientDataJson: String!, $authenticatorData: String!, $signature: String!) {
        logIn(
          input: {
            provider: PASSKEY
            passkey: {
              challengeToken: $challengeToken
              credentialId: $credentialId
              clientDataJson: $clientDataJson
              authenticatorData: $authenticatorData
              signature: $signature
            }
          }
        ) {
          accessToken {
            serializedValue
          }
          refreshToken {
            serializedValue
          }
          errors {
            field
            code
            message
          }
        }
      }
      """

      with_fake_passkey_adapter(fn ->
        assert {:ok,
                %{
                  data: %{
                    "beginAuthChallenge" => %{
                      "challenge" => %{"challengeToken" => sign_up_challenge_token}
                    }
                  }
                }} =
                 Absinthe.run(begin_sign_up_mutation, LCGQL.Schema,
                   variables: %{"email" => email}
                 )

        registration_input =
          registration_passkey_input(sign_up_challenge_token,
            credential_id: "graphql-login-passkey"
          )

        assert {:ok,
                %{
                  data: %{
                    "signUp" => %{
                      "accessToken" => %{"serializedValue" => _access_token},
                      "refreshToken" => %{"serializedValue" => _refresh_token},
                      "errors" => []
                    }
                  }
                }} =
                 Absinthe.run(sign_up_mutation, LCGQL.Schema,
                   variables: %{
                     "challengeToken" => sign_up_challenge_token,
                     "credentialId" => "graphql-login-passkey",
                     "clientDataJson" => registration_input.client_data_json,
                     "attestationObject" => registration_input.attestation_object
                   }
                 )

        assert {:ok,
                %{
                  data: %{
                    "beginAuthChallenge" => %{
                      "challenge" => %{"challengeToken" => login_challenge_token}
                    }
                  }
                }} =
                 Absinthe.run(begin_login_mutation, LCGQL.Schema, variables: %{"email" => email})

        assertion_input =
          assertion_passkey_input(login_challenge_token, "graphql-login-passkey", sign_count: 5)

        assert {:ok,
                %{
                  data: %{
                    "logIn" => %{
                      "accessToken" => %{"serializedValue" => _access_token},
                      "refreshToken" => %{"serializedValue" => _refresh_token},
                      "errors" => []
                    }
                  }
                }} =
                 Absinthe.run(log_in_mutation, LCGQL.Schema,
                   variables: %{
                     "challengeToken" => login_challenge_token,
                     "credentialId" => "graphql-login-passkey",
                     "clientDataJson" => assertion_input.client_data_json,
                     "authenticatorData" => assertion_input.authenticator_data,
                     "signature" => assertion_input.signature
                   }
                 )
      end)
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
