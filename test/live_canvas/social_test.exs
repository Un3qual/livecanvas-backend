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
end
