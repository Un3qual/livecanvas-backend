defmodule LC.ReadPolicyTest do
  use LC.DataCase, async: true

  import Ecto.Query
  import LC.AccountsFixtures

  alias LC.{ReadPolicy, Social}
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Social.Follow

  describe "relationship facts" do
    test "owns visibility reads instead of exporting them from Social" do
      assert Code.ensure_loaded?(Social)
      refute function_exported?(Social, :blocked_by?, 2)
      refute function_exported?(Social, :user_ids_blocking_viewer, 2)
      refute function_exported?(Social, :muted?, 2)
      refute function_exported?(Social, :relationship_state, 2)
      refute function_exported?(Social, :can_view_user?, 2)
      refute function_exported?(Social, :follower_users_query, 1)
      refute function_exported?(Social, :follower_users_query, 2)
      refute function_exported?(Social, :following_users_query, 1)
      refute function_exported?(Social, :following_users_query, 2)
    end

    test "distinguishes directional user resolution from symmetric blocking" do
      viewer = user_fixture()
      owner = user_fixture()

      assert {:ok, _block} = Social.block_user(owner, viewer)

      assert ReadPolicy.viewer_blocked_by_owner?(viewer, owner)
      refute ReadPolicy.viewer_blocked_by_owner?(owner, viewer)
      assert ReadPolicy.blocked_between?(viewer, owner)
      assert ReadPolicy.blocked_between?(owner, viewer)
    end

    test "returns blocking owner IDs in one batch" do
      viewer = user_fixture()
      blocking_owner = user_fixture()
      visible_owner = user_fixture()

      assert {:ok, _block} = Social.block_user(blocking_owner, viewer)

      assert ReadPolicy.blocking_owner_ids(viewer, [blocking_owner.id, visible_owner.id]) ==
               [blocking_owner.id]
    end

    test "keeps mute directional and separate from relationship-graph visibility" do
      viewer = user_fixture()
      public_owner = user_fixture(privacy_mode: :public)

      assert {:ok, _mute} = Social.mute_user(viewer, public_owner)

      assert ReadPolicy.viewer_muted_owner?(viewer, public_owner)
      refute ReadPolicy.viewer_muted_owner?(public_owner, viewer)

      assert ReadPolicy.viewer_can_view_relationship_graph?(viewer, public_owner, :public)
      refute ReadPolicy.viewer_can_read_owner?(viewer, public_owner, :public)
    end
  end

  describe "directional block scopes" do
    test "excludes only user owners who blocked the viewer" do
      viewer = user_fixture()
      blocking_owner = user_fixture()
      visible_owner = user_fixture()

      assert {:ok, _block} = Social.block_user(blocking_owner, viewer)

      visible_owner_ids =
        from(user in User,
          where: user.id in ^[blocking_owner.id, visible_owner.id],
          order_by: [asc: user.id]
        )
        |> ReadPolicy.exclude_owners_blocking_viewer(viewer, :id)
        |> Repo.all()
        |> Enum.map(& &1.id)

      assert visible_owner_ids == [visible_owner.id]
    end

    test "supports owner foreign keys on relationship queries" do
      viewer = user_fixture(privacy_mode: :private)
      blocking_requester = user_fixture()
      visible_requester = user_fixture()

      assert {:ok, blocking_follow} = Social.follow_user(blocking_requester, viewer)
      assert {:ok, visible_follow} = Social.follow_user(visible_requester, viewer)
      assert {:ok, _block} = Social.block_user(blocking_requester, viewer)

      visible_follow_ids =
        from(follow in Follow,
          where: follow.id in ^[blocking_follow.id, visible_follow.id],
          order_by: [asc: follow.id]
        )
        |> ReadPolicy.exclude_owners_blocking_viewer(viewer, :follower_id)
        |> Repo.all()
        |> Enum.map(& &1.id)

      assert visible_follow_ids == [visible_follow.id]
    end
  end

  describe "relationship state compatibility" do
    test "preserves public, requested, accepted, and blocked states" do
      viewer = user_fixture()
      public_owner = user_fixture(privacy_mode: :public)
      requested_owner = user_fixture(privacy_mode: :private)
      accepted_owner = user_fixture(privacy_mode: :private)
      blocked_owner = user_fixture(privacy_mode: :public)

      assert {:ok, _follow} = Social.follow_user(viewer, requested_owner)
      assert {:ok, follow} = Social.follow_user(viewer, accepted_owner)
      assert {:ok, _follow} = Social.accept_follow_request(follow, accepted_owner)
      assert {:ok, _block} = Social.block_user(viewer, blocked_owner)

      assert ReadPolicy.relationship_state(viewer, public_owner, :public) == :public
      assert ReadPolicy.relationship_state(viewer, requested_owner, :private) == :requested
      assert ReadPolicy.relationship_state(viewer, accepted_owner, :private) == :accepted
      assert ReadPolicy.relationship_state(viewer, blocked_owner, :public) == :blocked
    end
  end
end
