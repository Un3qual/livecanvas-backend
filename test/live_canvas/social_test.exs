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
end
