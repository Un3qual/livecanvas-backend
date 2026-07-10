defmodule LCGQL.Social.SocialMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Social}

  describe "followUser" do
    test "uses the authenticated viewer as follower" do
      viewer = user_fixture()
      followed = user_fixture(privacy_mode: :private)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation($followedId: ID!) {
        followUser(input: {followedId: $followedId}) {
          follow {
            id
            state
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
                  "followUser" => %{
                    "follow" => %{"id" => follow_id, "state" => "REQUESTED"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followedId" => followed_id},
                 context: context
               )

      assert is_binary(follow_id)
      assert :requested == Social.relationship_state(viewer, followed)
    end

    test "returns structured errors for non-global followedId values" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation($followedId: ID!) {
        followUser(input: {followedId: $followedId}) {
          follow {
            id
            state
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
                  "followUser" => %{
                    "follow" => nil,
                    "errors" => [%{"field" => "followedId", "message" => message} | _rest]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followedId" => "123"},
                 context: context
               )

      assert message =~ "invalid_id"
    end

    test "returns unauthenticated errors without a viewer scope" do
      followed = user_fixture(privacy_mode: :private)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      mutation = """
      mutation($followedId: ID!) {
        followUser(input: {followedId: $followedId}) {
          follow {
            id
            state
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
                  "followUser" => %{
                    "follow" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"followedId" => followed_id})
    end
  end

  describe "acceptFollowRequest" do
    test "uses the authenticated viewer as acting user" do
      requester = user_fixture()
      viewer = user_fixture(privacy_mode: :private)
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      requester_id = Absinthe.Relay.Node.to_global_id(:user, requester.id, LCGQL.Schema)

      assert {:ok, _follow} = Social.follow_user(requester, viewer)

      mutation = """
      mutation($followerId: ID!) {
        acceptFollowRequest(input: {followerId: $followerId}) {
          follow {
            id
            state
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
                  "acceptFollowRequest" => %{
                    "follow" => %{"id" => follow_id, "state" => "ACCEPTED"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => requester_id},
                 context: context
               )

      assert is_binary(follow_id)
      assert :accepted == Social.relationship_state(requester, viewer)
    end

    test "removes the request from the pending inbox once accepted" do
      requester = user_fixture()
      viewer = user_fixture(privacy_mode: :private)
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      requester_id = Absinthe.Relay.Node.to_global_id(:user, requester.id, LCGQL.Schema)

      assert {:ok, _follow} = Social.follow_user(requester, viewer)

      mutation = """
      mutation($followerId: ID!) {
        acceptFollowRequest(input: {followerId: $followerId}) {
          follow {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      inbox_query = """
      query {
        viewerPendingFollowRequests(first: 10) {
          edges {
            node {
              id
            }
          }
        }
      }
      """

      assert {:ok, %{data: %{"viewerPendingFollowRequests" => %{"edges" => [_pending_request]}}}} =
               Absinthe.run(inbox_query, LCGQL.Schema, context: context)

      assert {:ok, %{data: %{"acceptFollowRequest" => %{"errors" => []}}}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => requester_id},
                 context: context
               )

      assert {:ok, %{data: %{"viewerPendingFollowRequests" => %{"edges" => []}}}} =
               Absinthe.run(inbox_query, LCGQL.Schema, context: context)
    end

    test "returns unauthenticated errors without a viewer scope" do
      requester = user_fixture()
      requester_id = Absinthe.Relay.Node.to_global_id(:user, requester.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!) {
        acceptFollowRequest(input: {followerId: $followerId}) {
          follow {
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
                  "acceptFollowRequest" => %{
                    "follow" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"followerId" => requester_id})
    end
  end

  describe "declineFollowRequest" do
    test "uses the authenticated viewer as acting user" do
      requester = user_fixture()
      viewer = user_fixture(privacy_mode: :private)
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      requester_id = Absinthe.Relay.Node.to_global_id(:user, requester.id, LCGQL.Schema)

      assert {:ok, follow} = Social.follow_user(requester, viewer)

      mutation = """
      mutation($followerId: ID!) {
        declineFollowRequest(input: {followerId: $followerId}) {
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
                  "declineFollowRequest" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => requester_id},
                 context: context
               )

      assert Social.get_pending_follow_request(viewer, follow.id) == nil
      assert :none == Social.relationship_state(requester, viewer)
    end

    test "returns unauthenticated errors without a viewer scope" do
      requester = user_fixture()
      requester_id = Absinthe.Relay.Node.to_global_id(:user, requester.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!) {
        declineFollowRequest(input: {followerId: $followerId}) {
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
                  "declineFollowRequest" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"followerId" => requester_id})
    end
  end

  describe "unfollowUser" do
    test "uses the authenticated viewer, preserves the reverse follow, and is idempotent" do
      viewer = user_fixture(privacy_mode: :public)
      followed = user_fixture(privacy_mode: :public)
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      assert {:ok, _follow} = Social.follow_user(viewer, followed)
      assert {:ok, _reverse_follow} = Social.follow_user(followed, viewer)

      mutation = """
      mutation($followedId: ID!) {
        unfollowUser(input: {followedId: $followedId}) {
          errors { field message }
        }
      }
      """

      for _attempt <- 1..2 do
        assert {:ok, %{data: %{"unfollowUser" => %{"errors" => []}}}} =
                 Absinthe.run(mutation, LCGQL.Schema,
                   variables: %{"followedId" => followed_id},
                   context: context
                 )
      end

      assert Social.relationship_state(viewer, followed) == :public
      assert Social.relationship_state(followed, viewer) == :accepted
    end

    test "returns a field error for an invalid followedId and an auth error without scope" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation($followedId: ID!) {
        unfollowUser(input: {followedId: $followedId}) {
          errors { field message }
        }
      }
      """

      assert {:ok, %{data: %{"unfollowUser" => %{"errors" => [%{"field" => "followedId"}]}}}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followedId" => "123"},
                 context: context
               )

      followed = user_fixture()
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "unfollowUser" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"followedId" => followed_id})
    end
  end

  describe "unblockUser" do
    test "removes only the viewer's outbound block and is idempotent" do
      viewer = user_fixture()
      blocked = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

      assert {:ok, _outbound_block} = Social.block_user(viewer, blocked)
      assert {:ok, _inbound_block} = Social.block_user(blocked, viewer)

      mutation = """
      mutation($blockedId: ID!) {
        unblockUser(input: {blockedId: $blockedId}) {
          errors { field message }
        }
      }
      """

      for _attempt <- 1..2 do
        assert {:ok, %{data: %{"unblockUser" => %{"errors" => []}}}} =
                 Absinthe.run(mutation, LCGQL.Schema,
                   variables: %{"blockedId" => blocked_id},
                   context: context
                 )
      end

      refute Social.blocked_by_viewer?(viewer, blocked)
      assert Social.blocked_by_viewer?(blocked, viewer)
    end

    test "returns a field error for invalid blockedId and unauthenticated without scope" do
      viewer = user_fixture()
      blocked = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

      mutation = """
      mutation($blockedId: ID!) {
        unblockUser(input: {blockedId: $blockedId}) {
          errors { field message }
        }
      }
      """

      assert {:ok, %{data: %{"unblockUser" => %{"errors" => [%{"field" => "blockedId"}]}}}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"blockedId" => "123"},
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "unblockUser" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema, variables: %{"blockedId" => blocked_id})
    end
  end

  describe "schema cleanup" do
    test "does not expose legacy successful relay payload fields" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "BlockUserPayload {\n  successful: Boolean!"
      refute schema_sdl =~ "MuteUserPayload {\n  successful: Boolean!"
      refute schema_sdl =~ "UnmuteUserPayload {\n  successful: Boolean!"
      refute schema_sdl =~ "UnfollowUserPayload {\n  successful: Boolean!"
      refute schema_sdl =~ "UnblockUserPayload {\n  successful: Boolean!"
    end
  end

  describe "blockUser" do
    test "returns no errors when block is persisted" do
      viewer = user_fixture()
      blocked = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

      mutation = """
      mutation($blockedId: ID!) {
        blockUser(input: {blockedId: $blockedId}) {
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
                  "blockUser" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"blockedId" => blocked_id},
                 context: context
               )
    end

    test "returns unauthenticated errors without a viewer scope" do
      blocked = user_fixture()
      blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

      mutation = """
      mutation($blockedId: ID!) {
        blockUser(input: {blockedId: $blockedId}) {
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
                  "blockUser" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"blockedId" => blocked_id})
    end
  end

  describe "muteUser" do
    test "returns no errors when mute is persisted" do
      viewer = user_fixture()
      muted = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      mutation = """
      mutation($mutedId: ID!) {
        muteUser(input: {mutedId: $mutedId}) {
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
                  "muteUser" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mutedId" => muted_id},
                 context: context
               )

      assert Social.muted?(viewer, muted)
    end

    test "returns structured errors for non-global ids" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation($mutedId: ID!) {
        muteUser(input: {mutedId: $mutedId}) {
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
                  "muteUser" => %{
                    "errors" => [%{"field" => "mutedId", "message" => message} | _rest]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mutedId" => "123"},
                 context: context
               )

      assert message =~ "invalid_id"
    end

    test "returns unauthenticated errors without a viewer scope" do
      muted = user_fixture()
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      mutation = """
      mutation($mutedId: ID!) {
        muteUser(input: {mutedId: $mutedId}) {
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
                  "muteUser" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"mutedId" => muted_id})
    end
  end

  describe "unmuteUser" do
    test "returns no errors and clears an existing mute relationship" do
      viewer = user_fixture()
      muted = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      {:ok, _mute} = Social.mute_user(viewer, muted)

      mutation = """
      mutation($mutedId: ID!) {
        unmuteUser(input: {mutedId: $mutedId}) {
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
                  "unmuteUser" => %{
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mutedId" => muted_id},
                 context: context
               )

      refute Social.muted?(viewer, muted)
    end

    test "returns unauthenticated errors without a viewer scope" do
      muted = user_fixture()
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      mutation = """
      mutation($mutedId: ID!) {
        unmuteUser(input: {mutedId: $mutedId}) {
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
                  "unmuteUser" => %{
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"mutedId" => muted_id})
    end
  end
end
