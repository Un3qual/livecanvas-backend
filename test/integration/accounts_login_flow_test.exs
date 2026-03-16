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

    creator_global_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)
    viewer_global_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

    follow_mutation = """
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
                  "follow" => %{"id" => _follow_id, "state" => "ACCEPTED"},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(follow_mutation, LCGQL.Schema,
               variables: %{"followedId" => creator_global_id},
               context: %{current_scope: scope}
             )

    create_post_mutation = """
    mutation($bodyText: String!) {
      createPost(input: {kind: STANDARD, bodyText: $bodyText}) {
        post {
          id
          bodyText
          author {
            id
          }
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
                  "post" => %{
                    "id" => post_global_id,
                    "bodyText" => "integration-post",
                    "author" => %{"id" => ^viewer_global_id}
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(create_post_mutation, LCGQL.Schema,
               variables: %{"bodyText" => "integration-post"},
               context: %{current_scope: scope}
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

  test "graphql password signup, follow, post, and feed retrieval" do
    viewer_email = unique_user_email()
    viewer_password = valid_user_password()
    creator = user_fixture(privacy_mode: :public)

    sign_up_mutation = """
    mutation($email: String!, $password: String!, $passwordConfirmation: String!) {
      signUp(
        input: {
          provider: PASSWORD
          password: {
            email: $email
            password: $password
            passwordConfirmation: $passwordConfirmation
          }
        }
      ) {
        accessToken {
          serializedValue
        }
        refreshToken {
          serializedValue
        }
        errors {
          field
          code
          message
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "signUp" => %{
                  "accessToken" => %{"serializedValue" => access_token},
                  "refreshToken" => %{"serializedValue" => _refresh_token},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(sign_up_mutation, LCGQL.Schema,
               variables: %{
                 "email" => viewer_email,
                 "password" => viewer_password,
                 "passwordConfirmation" => viewer_password
               }
             )

    assert {:ok, scope} = Accounts.authenticate_access_token(access_token)
    assert %{id: viewer_id, email: ^viewer_email} = scope.user

    creator_global_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)
    viewer_global_id = Absinthe.Relay.Node.to_global_id(:user, viewer_id, LCGQL.Schema)

    follow_mutation = """
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
                  "follow" => %{"id" => _follow_id, "state" => "ACCEPTED"},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(follow_mutation, LCGQL.Schema,
               variables: %{"followedId" => creator_global_id},
               context: %{current_scope: scope}
             )

    create_post_mutation = """
    mutation($bodyText: String!) {
      createPost(input: {kind: STANDARD, bodyText: $bodyText}) {
        post {
          id
          bodyText
          author {
            id
          }
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
                  "post" => %{
                    "id" => post_global_id,
                    "bodyText" => "graphql-auth-post",
                    "author" => %{"id" => ^viewer_global_id}
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(create_post_mutation, LCGQL.Schema,
               variables: %{"bodyText" => "graphql-auth-post"},
               context: %{current_scope: scope}
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
                    %{"node" => %{"id" => ^post_global_id, "bodyText" => "graphql-auth-post"}}
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
