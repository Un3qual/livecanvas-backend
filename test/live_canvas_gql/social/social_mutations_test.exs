defmodule LCGQL.Social.SocialMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Social}
  alias LC.Infra.Repo
  alias LCSchemas.Social.{Block, Follow, Mute}

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

  describe "schema cleanup" do
    test "does not expose legacy successful relay payload fields" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "BlockUserPayload {\n  successful: Boolean!"
      refute schema_sdl =~ "MuteUserPayload {\n  successful: Boolean!"
      refute schema_sdl =~ "UnmuteUserPayload {\n  successful: Boolean!"
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

  describe "hidden-target mutation privacy" do
    test "followUser treats a target who blocked the viewer exactly like a missing user" do
      viewer = user_fixture()
      target = user_fixture(privacy_mode: :public)
      target_id = Absinthe.Relay.Node.to_global_id(:user, target.id, LCGQL.Schema)
      missing_id = Absinthe.Relay.Node.to_global_id(:user, 9_999_999_999, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, _block} = Social.block_user(target, viewer)

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

      assert {:ok, hidden_result} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followedId" => target_id},
                 context: context
               )

      assert {:ok, missing_result} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followedId" => missing_id},
                 context: context
               )

      assert hidden_result == missing_result

      assert hidden_result == %{
               data: %{
                 "followUser" => %{
                   "follow" => nil,
                   "errors" => [%{"field" => "followedId", "message" => "not_found"}]
                 }
               }
             }

      assert Repo.get_by(Follow, follower_id: viewer.id, followed_id: target.id) == nil
    end

    test "follow-request mutations treat requesters who blocked the viewer as missing" do
      viewer = user_fixture(privacy_mode: :private)
      accept_requester = user_fixture()
      decline_requester = user_fixture()

      accept_requester_id =
        Absinthe.Relay.Node.to_global_id(:user, accept_requester.id, LCGQL.Schema)

      decline_requester_id =
        Absinthe.Relay.Node.to_global_id(:user, decline_requester.id, LCGQL.Schema)

      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, accept_follow} = Social.follow_user(accept_requester, viewer)
      assert {:ok, decline_follow} = Social.follow_user(decline_requester, viewer)
      assert {:ok, _block} = Social.block_user(accept_requester, viewer)
      assert {:ok, _block} = Social.block_user(decline_requester, viewer)

      mutation = """
      mutation($acceptRequesterId: ID!, $declineRequesterId: ID!) {
        accept: acceptFollowRequest(input: {followerId: $acceptRequesterId}) {
          follow {
            id
          }
          errors {
            field
            message
          }
        }
        decline: declineFollowRequest(input: {followerId: $declineRequesterId}) {
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
                  "accept" => %{
                    "follow" => nil,
                    "errors" => [%{"field" => "followerId", "message" => "not_found"}]
                  },
                  "decline" => %{
                    "errors" => [%{"field" => "followerId", "message" => "not_found"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{
                   "acceptRequesterId" => accept_requester_id,
                   "declineRequesterId" => decline_requester_id
                 },
                 context: context
               )

      assert Repo.get!(Follow, accept_follow.id).state == :requested
      assert Repo.get!(Follow, decline_follow.id).state == :requested
    end

    test "error-only social controls treat a blocker as missing without side effects" do
      viewer = user_fixture()
      target = user_fixture()
      target_id = Absinthe.Relay.Node.to_global_id(:user, target.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      assert {:ok, existing_mute} = Social.mute_user(viewer, target)
      assert {:ok, _block} = Social.block_user(target, viewer)

      mutation = """
      mutation($targetId: ID!) {
        block: blockUser(input: {blockedId: $targetId}) {
          errors { field message }
        }
        mute: muteUser(input: {mutedId: $targetId}) {
          errors { field message }
        }
        unmute: unmuteUser(input: {mutedId: $targetId}) {
          errors { field message }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "block" => %{
                    "errors" => [%{"field" => "blockedId", "message" => "not_found"}]
                  },
                  "mute" => %{
                    "errors" => [%{"field" => "mutedId", "message" => "not_found"}]
                  },
                  "unmute" => %{
                    "errors" => [%{"field" => "mutedId", "message" => "not_found"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"targetId" => target_id},
                 context: context
               )

      assert Repo.get_by(Block, blocker_id: viewer.id, blocked_id: target.id) == nil
      assert Repo.get!(Mute, existing_mute.id).id == existing_mute.id
    end
  end
end
