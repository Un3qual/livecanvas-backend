defmodule LCGQL.Content.ContentQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Content}

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

  test "mediaAsset query returns viewer-owned media by global ID" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    assert {:ok, %{media_asset: media_asset}} =
             Content.request_media_upload(viewer, %{mime_type: "image/jpeg"})

    media_asset_id = Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      mediaAsset(id: $id) {
        id
        mimeType
        processingState
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "mediaAsset" => %{
                  "id" => returned_media_asset_id,
                  "mimeType" => "image/jpeg",
                  "processingState" => "PENDING_UPLOAD"
                }
              }
            }} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => media_asset_id}, context: context)

    assert returned_media_asset_id == media_asset_id
  end

  test "mediaAsset query returns null without matching viewer scope" do
    owner = user_fixture()
    other_viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(other_viewer)}

    assert {:ok, %{media_asset: media_asset}} =
             Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

    media_asset_id = Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      mediaAsset(id: $id) {
        id
      }
    }
    """

    assert {:ok, %{data: %{"mediaAsset" => nil}}} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => media_asset_id})

    assert {:ok, %{data: %{"mediaAsset" => nil}}} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => media_asset_id}, context: context)
  end
end
