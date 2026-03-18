defmodule LC.SocialTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Social

  test "private accounts start as requested" do
    follower = user_fixture()
    followed = user_fixture(privacy_mode: :private)

    assert {:ok, follow} = Social.follow_user(follower, followed)
    assert follow.state == :requested
  end

  test "blocking overrides follow visibility" do
    viewer = user_fixture()
    creator = user_fixture(privacy_mode: :public)

    assert {:ok, _follow} = Social.follow_user(viewer, creator)
    assert {:ok, _block} = Social.block_user(creator, viewer)

    assert :blocked = Social.relationship_state(viewer, creator)
    refute Social.can_view_user?(viewer, creator)
  end

  describe "mute controls" do
    test "mute_user/2 persists a directional mute relationship" do
      muter = user_fixture()
      muted = user_fixture()

      assert {:ok, _mute} = Social.mute_user(muter, muted)
      assert Social.muted?(muter, muted)
      refute Social.muted?(muted, muter)
    end

    test "mute_user/2 is idempotent for the same muter/muted pair" do
      muter = user_fixture()
      muted = user_fixture()

      assert {:ok, first_mute} = Social.mute_user(muter, muted)
      assert {:ok, second_mute} = Social.mute_user(muter, muted)

      assert first_mute.id == second_mute.id
      assert Social.muted?(muter, muted)
    end

    test "unmute_user/2 removes a mute relationship and is idempotent" do
      muter = user_fixture()
      muted = user_fixture()

      assert {:ok, _mute} = Social.mute_user(muter, muted)
      assert :ok = Social.unmute_user(muter, muted)
      refute Social.muted?(muter, muted)

      assert :ok = Social.unmute_user(muter, muted)
      refute Social.muted?(muter, muted)
    end
  end

  describe "viewer visibility matrix" do
    test "keeps block, mute, reverse-mute, and follower/public state separate" do
      viewer = user_fixture()
      public_creator = user_fixture(privacy_mode: :public)
      private_creator = user_fixture(privacy_mode: :private)
      followed_private_creator = user_fixture(privacy_mode: :private)
      blocked_creator = user_fixture(privacy_mode: :public)
      muted_creator = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)

      assert {:ok, follow} = Social.follow_user(viewer, followed_private_creator)

      assert {:ok, _accepted_follow} =
               Social.accept_follow_request(follow, followed_private_creator)

      assert {:ok, _block} = Social.block_user(blocked_creator, viewer)
      assert {:ok, _mute} = Social.mute_user(viewer, muted_creator)
      assert {:ok, _reverse_mute} = Social.mute_user(reverse_muter, viewer)

      assert Social.relationship_state(viewer, public_creator) == :public
      assert Social.relationship_state(viewer, private_creator) == :none
      assert Social.relationship_state(viewer, followed_private_creator) == :accepted
      assert Social.relationship_state(viewer, blocked_creator) == :blocked
      assert Social.relationship_state(viewer, muted_creator) == :public
      assert Social.relationship_state(viewer, reverse_muter) == :public

      assert Social.can_view_user?(viewer, public_creator)
      refute Social.can_view_user?(viewer, private_creator)
      assert Social.can_view_user?(viewer, followed_private_creator)
      refute Social.can_view_user?(viewer, blocked_creator)
      assert Social.can_view_user?(viewer, muted_creator)
      assert Social.can_view_user?(viewer, reverse_muter)

      assert Social.muted?(viewer, muted_creator)
      refute Social.muted?(muted_creator, viewer)
      refute Social.muted?(viewer, reverse_muter)
      assert Social.muted?(reverse_muter, viewer)
    end
  end

  describe "pending follow requests" do
    test "pending_follow_requests_query/1 returns only pending inbound requests in stable order" do
      followed = user_fixture(privacy_mode: :private)
      follower_1 = user_fixture()
      follower_2 = user_fixture()
      accepted_follower = user_fixture()

      assert {:ok, follow_1} = Social.follow_user(follower_1, followed)
      assert {:ok, follow_2} = Social.follow_user(follower_2, followed)

      assert {:ok, accepted_follow} = Social.follow_user(accepted_follower, followed)
      assert {:ok, _accepted_follow} = Social.accept_follow_request(accepted_follow, followed)

      pending_requests =
        followed
        |> Social.pending_follow_requests_query()
        |> Social.run_query()

      assert Enum.map(pending_requests, & &1.id) == [follow_1.id, follow_2.id]
      assert Enum.map(pending_requests, & &1.follower_id) == [follower_1.id, follower_2.id]
      assert Enum.all?(pending_requests, &(&1.state == :requested))
    end

    test "get_pending_follow_request/2 returns only viewer-owned pending rows" do
      followed = user_fixture(privacy_mode: :private)
      other_user = user_fixture()
      follower = user_fixture()

      assert {:ok, follow} = Social.follow_user(follower, followed)
      assert Social.get_pending_follow_request(followed, follow.id).id == follow.id
      assert Social.get_pending_follow_request(other_user, follow.id) == nil

      assert {:ok, accepted_follow} = Social.accept_follow_request(follow, followed)
      assert Social.get_pending_follow_request(followed, accepted_follow.id) == nil
    end

    test "decline_follow_request/2 deletes a pending request" do
      followed = user_fixture(privacy_mode: :private)
      follower = user_fixture()

      assert {:ok, follow} = Social.follow_user(follower, followed)
      assert :ok = Social.decline_follow_request(follow, followed)

      assert Social.get_pending_follow_request(followed, follow.id) == nil
      assert :none == Social.relationship_state(follower, followed)
    end
  end
end
