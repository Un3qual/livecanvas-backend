defmodule LC.Integration.AccountsLoginFlowTest do
  use LCWeb.ConnCase, async: false

  import LC.AccountsFixtures

  alias LC.Accounts

  test "email registration, login, follow, post, and feed retrieval", %{conn: conn} do
    viewer_email = unique_user_email()
    creator = user_fixture(privacy_mode: :public)

    conn =
      post(conn, ~p"/users/register", %{
        "user" => valid_user_attributes(email: viewer_email)
      })

    assert redirected_to(conn) == ~p"/users/log-in"
    assert %{id: _viewer_id} = viewer = Accounts.get_user_by_email(viewer_email)

    {magic_link_token, _secret_hash} = generate_user_magic_link_token(viewer)

    conn =
      conn
      |> recycle()
      |> post(~p"/users/log-in", %{
        "user" => %{"token" => magic_link_token}
      })

    assert redirected_to(conn) == ~p"/"

    assert %{user: %{id: viewer_id}} = scope = authenticated_scope_from_conn(conn)
    assert viewer_id == viewer.id

    viewer_global_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
    creator_global_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)

    follow_mutation = """
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
                  "follow" => %{"id" => _follow_id, "state" => "ACCEPTED"},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(follow_mutation, LCGQL.Schema,
               variables: %{"followerId" => viewer_global_id, "followedId" => creator_global_id}
             )

    create_post_mutation = """
    mutation($authorId: ID!, $bodyText: String!) {
      createPost(input: {authorId: $authorId, kind: STANDARD, bodyText: $bodyText}) {
        post {
          id
          bodyText
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
                "createPost" => %{
                  "post" => %{"id" => post_global_id, "bodyText" => "integration-post"},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(create_post_mutation, LCGQL.Schema,
               variables: %{"authorId" => creator_global_id, "bodyText" => "integration-post"}
             )

    home_feed_query = """
    query($first: Int!) {
      homeFeed(first: $first) {
        edges {
          node {
            id
            bodyText
          }
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "homeFeed" => %{
                  "edges" => [
                    %{"node" => %{"id" => ^post_global_id, "bodyText" => "integration-post"}}
                  ]
                }
              }
            }} =
             Absinthe.run(home_feed_query, LCGQL.Schema,
               variables: %{"first" => 10},
               context: %{current_scope: scope}
             )
  end
end
