defmodule LCGQL.Social.SocialMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures
  alias LC.Social

  describe "followUser" do
    test "returns requested for a private account" do
      follower = user_fixture()
      followed = user_fixture(privacy_mode: :private)
      follower_id = Absinthe.Relay.Node.to_global_id(:user, follower.id, LCGQL.Schema)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!, $followedId: ID!) {
        followUser(input: {followerId: $followerId, followedId: $followedId}) {
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
                 variables: %{"followerId" => follower_id, "followedId" => followed_id}
               )

      assert is_binary(follow_id)
    end

    test "rejects a raw numeric followerId that is not a relay global id" do
      follower = user_fixture()
      followed = user_fixture(privacy_mode: :private)
      followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

      mutation = """
      mutation($followerId: ID!, $followedId: ID!) {
        followUser(input: {followerId: $followerId, followedId: $followedId}) {
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
                    "errors" => [%{"field" => "followerId", "message" => message} | _rest]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followerId" => "#{follower.id}", "followedId" => followed_id}
               )

      assert message =~ "invalid_id"
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
      blocker = user_fixture()
      blocked = user_fixture()
      blocker_id = Absinthe.Relay.Node.to_global_id(:user, blocker.id, LCGQL.Schema)
      blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

      mutation = """
      mutation($blockerId: ID!, $blockedId: ID!) {
        blockUser(input: {blockerId: $blockerId, blockedId: $blockedId}) {
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
                 variables: %{"blockerId" => blocker_id, "blockedId" => blocked_id}
               )
    end
  end

  describe "muteUser" do
    test "returns no errors when mute is persisted" do
      muter = user_fixture()
      muted = user_fixture()
      muter_id = Absinthe.Relay.Node.to_global_id(:user, muter.id, LCGQL.Schema)
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      mutation = """
      mutation($muterId: ID!, $mutedId: ID!) {
        muteUser(input: {muterId: $muterId, mutedId: $mutedId}) {
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
                 variables: %{"muterId" => muter_id, "mutedId" => muted_id}
               )

      assert Social.muted?(muter, muted)
    end

    test "returns structured errors for non-global ids" do
      muter = user_fixture()
      muted = user_fixture()
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      mutation = """
      mutation($muterId: ID!, $mutedId: ID!) {
        muteUser(input: {muterId: $muterId, mutedId: $mutedId}) {
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
                    "errors" => [%{"field" => "muterId", "message" => message} | _rest]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"muterId" => "#{muter.id}", "mutedId" => muted_id}
               )

      assert message =~ "invalid_id"
    end
  end

  describe "unmuteUser" do
    test "returns no errors and clears an existing mute relationship" do
      muter = user_fixture()
      muted = user_fixture()
      muter_id = Absinthe.Relay.Node.to_global_id(:user, muter.id, LCGQL.Schema)
      muted_id = Absinthe.Relay.Node.to_global_id(:user, muted.id, LCGQL.Schema)

      {:ok, _mute} = Social.mute_user(muter, muted)

      mutation = """
      mutation($muterId: ID!, $mutedId: ID!) {
        unmuteUser(input: {muterId: $muterId, mutedId: $mutedId}) {
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
                 variables: %{"muterId" => muter_id, "mutedId" => muted_id}
               )

      refute Social.muted?(muter, muted)
    end
  end
end
