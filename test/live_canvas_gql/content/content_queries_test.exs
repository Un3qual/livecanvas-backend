defmodule LCGQL.Content.ContentQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Content

  test "post query returns a Relay node by global ID" do
    author = user_fixture()
    {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "first post"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)
    author_id = Absinthe.Relay.Node.to_global_id(:user, author.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      post(id: $id) {
        id
        kind
        bodyText
        author {
          id
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "post" => %{
                  "id" => returned_post_id,
                  "kind" => "STANDARD",
                  "bodyText" => "first post",
                  "author" => %{"id" => returned_author_id}
                }
              }
            }} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

    assert returned_post_id == post_id
    assert returned_author_id == author_id
  end
end
