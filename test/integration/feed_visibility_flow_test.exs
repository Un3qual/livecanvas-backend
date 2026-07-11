defmodule LC.Integration.FeedVisibilityFlowTest do
  use LC.DataCase, async: false

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.Content

  test "feed and social GraphQL APIs apply the same viewer visibility matrix" do
    viewer = user_fixture()
    followed_creator = user_fixture()
    public_creator = user_fixture(privacy_mode: :public)
    blocked_creator = user_fixture(privacy_mode: :public)
    muted_creator = user_fixture(privacy_mode: :public)
    reverse_muter = user_fixture(privacy_mode: :public)

    _accepted_follow = accepted_follow_fixture(viewer, followed_creator)
    _block = block_fixture(blocked_creator, viewer)
    _mute = mute_fixture(viewer, muted_creator)
    _reverse_mute = mute_fixture(reverse_muter, viewer)

    {:ok, followed_post} =
      Content.create_post(followed_creator, %{kind: :standard, body_text: "followers-visible"})

    {:ok, public_post} =
      Content.create_post(public_creator, %{
        kind: :standard,
        body_text: "public-visible",
        visibility: :public
      })

    {:ok, _blocked_post} =
      Content.create_post(blocked_creator, %{
        kind: :standard,
        body_text: "blocked-hidden",
        visibility: :public
      })

    {:ok, _muted_post} =
      Content.create_post(muted_creator, %{
        kind: :standard,
        body_text: "muted-hidden",
        visibility: :public
      })

    {:ok, reverse_muted_post} =
      Content.create_post(reverse_muter, %{
        kind: :standard,
        body_text: "reverse-mute-visible",
        visibility: :public
      })

    public_post_id = Absinthe.Relay.Node.to_global_id(:post, public_post.id, LCGQL.Schema)
    followed_post_id = Absinthe.Relay.Node.to_global_id(:post, followed_post.id, LCGQL.Schema)

    reverse_muted_post_id =
      Absinthe.Relay.Node.to_global_id(:post, reverse_muted_post.id, LCGQL.Schema)

    visibility_query = """
    query(
      $first: Int!,
      $publicCreatorId: ID!,
      $followedCreatorId: ID!,
      $blockedCreatorId: ID!,
      $mutedCreatorId: ID!,
      $reverseMuterId: ID!
    ) {
      homeFeed(first: $first) {
        edges {
          node {
            id
            bodyText
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
      publicRelationship: relationshipState(creatorId: $publicCreatorId)
      followedRelationship: relationshipState(creatorId: $followedCreatorId)
      blockedRelationship: relationshipState(creatorId: $blockedCreatorId)
      mutedRelationship: relationshipState(creatorId: $mutedCreatorId)
      reverseMutedRelationship: relationshipState(creatorId: $reverseMuterId)
      mutedCreatorMuted: isMuted(creatorId: $mutedCreatorId)
      reverseMuterMuted: isMuted(creatorId: $reverseMuterId)
    }
    """

    assert {:ok,
            %{
              data: %{
                "homeFeed" => %{
                  "edges" => [
                    %{
                      "node" => %{
                        "id" => ^reverse_muted_post_id,
                        "bodyText" => "reverse-mute-visible"
                      }
                    },
                    %{"node" => %{"id" => ^public_post_id, "bodyText" => "public-visible"}},
                    %{"node" => %{"id" => ^followed_post_id, "bodyText" => "followers-visible"}}
                  ],
                  "pageInfo" => %{"hasNextPage" => false, "endCursor" => end_cursor}
                },
                "publicRelationship" => "PUBLIC",
                "followedRelationship" => "ACCEPTED",
                "blockedRelationship" => "NONE",
                "mutedRelationship" => "PUBLIC",
                "reverseMutedRelationship" => "PUBLIC",
                "mutedCreatorMuted" => true,
                "reverseMuterMuted" => false
              }
            }} =
             Absinthe.run(visibility_query, LCGQL.Schema,
               variables: %{
                 "first" => 10,
                 "publicCreatorId" =>
                   Absinthe.Relay.Node.to_global_id(:user, public_creator.id, LCGQL.Schema),
                 "followedCreatorId" =>
                   Absinthe.Relay.Node.to_global_id(:user, followed_creator.id, LCGQL.Schema),
                 "blockedCreatorId" =>
                   Absinthe.Relay.Node.to_global_id(:user, blocked_creator.id, LCGQL.Schema),
                 "mutedCreatorId" =>
                   Absinthe.Relay.Node.to_global_id(:user, muted_creator.id, LCGQL.Schema),
                 "reverseMuterId" =>
                   Absinthe.Relay.Node.to_global_id(:user, reverse_muter.id, LCGQL.Schema)
               },
               context: %{current_scope: authenticated_scope(viewer)}
             )

    assert is_binary(end_cursor)
  end
end
