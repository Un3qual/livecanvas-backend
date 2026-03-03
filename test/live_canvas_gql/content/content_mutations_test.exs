defmodule LCGQL.Content.ContentMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  test "createPost persists a post for the Relay authorId" do
    author = user_fixture()
    author_id = Absinthe.Relay.Node.to_global_id(:user, author.id, LCGQL.Schema)

    mutation = """
    mutation($authorId: ID!, $bodyText: String!) {
      createPost(input: {authorId: $authorId, kind: STANDARD, bodyText: $bodyText}) {
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
               variables: %{"authorId" => author_id, "bodyText" => "first post"}
             )

    assert is_binary(post_id)
    assert returned_author_id == author_id
  end
end
