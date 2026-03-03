defmodule LC.Social.RelationshipPolicyTest do
  use ExUnit.Case, async: true

  alias LC.Social.RelationshipPolicy

  test "public accounts auto-accept follows" do
    assert %{state: :accepted, accepted_at: %DateTime{}} =
             RelationshipPolicy.follow_decision(%{
               follower_id: 1,
               followed_id: 2,
               followed_privacy_mode: :public,
               blocked?: false,
               now: DateTime.utc_now()
             })
  end
end
