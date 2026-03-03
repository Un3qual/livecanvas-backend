defmodule LCGQL.Content.ContentMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts

  test "createPost persists a post for the authenticated viewer" do
    viewer = user_fixture()
    viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($bodyText: String!) {
      createPost(input: {kind: STANDARD, bodyText: $bodyText}) {
        post {
          id
          kind
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
                    "id" => post_id,
                    "kind" => "STANDARD",
                    "bodyText" => "first post",
                    "author" => %{"id" => returned_author_id}
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"bodyText" => "first post"},
               context: context
             )

    assert is_binary(post_id)
    assert returned_author_id == viewer_id
  end

  test "createPost returns unauthenticated errors without a viewer scope" do
    mutation = """
    mutation($bodyText: String!) {
      createPost(input: {kind: STANDARD, bodyText: $bodyText}) {
        post {
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
                "createPost" => %{
                  "post" => nil,
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"bodyText" => "first post"})
  end
end
