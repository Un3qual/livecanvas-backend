defmodule LCGQL.Content.ContentQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Content}
  alias LCSchemas.Content.Post

  test "post query returns a public post by global ID" do
    author = user_fixture()
    {:ok, post} =
      Content.create_post(author, %{kind: :standard, body_text: "first post", visibility: :public})

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

  test "post query serializes story post kinds without raising" do
    author = user_fixture()

    {:ok, post} =
      Content.create_post(author, %{kind: :story, body_text: "story post", visibility: :public})

    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      post(id: $id) {
        id
        kind
        expiresAt
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "post" => %{
                  "id" => returned_post_id,
                  "kind" => "STORY",
                  "expiresAt" => expires_at
                }
              }
            }} = Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

    assert returned_post_id == post_id
    assert is_binary(expires_at)
  end

  test "post query exposes attached media assets for a visible story post" do
    author = user_fixture()

    assert {:ok, uploaded_asset} =
             Content.create_media_asset(author, %{
               storage_key: "uploads/users/#{author.id}/story-uploaded.jpg",
               mime_type: "image/jpeg",
               processing_state: :uploaded
             })

    assert {:ok, processed_asset} =
             Content.create_media_asset(author, %{
               storage_key: "uploads/users/#{author.id}/story-processed.jpg",
               mime_type: "image/jpeg",
               processing_state: :processed
             })

    {:ok, post} =
      Content.create_post(author, %{
        kind: :story,
        body_text: "story post",
        visibility: :public,
        media_asset_ids: [uploaded_asset.id, processed_asset.id]
      })

    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)
    uploaded_asset_id = Absinthe.Relay.Node.to_global_id(:media_asset, uploaded_asset.id, LCGQL.Schema)
    processed_asset_id = Absinthe.Relay.Node.to_global_id(:media_asset, processed_asset.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      post(id: $id) {
        id
        mediaAssets {
          id
          mimeType
          processingState
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "post" => %{
                  "id" => returned_post_id,
                  "mediaAssets" => media_assets
                }
              }
            }} = Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

    assert returned_post_id == post_id

    assert Enum.sort_by(media_assets, & &1["id"]) == [
             %{
               "id" => uploaded_asset_id,
               "mimeType" => "image/jpeg",
               "processingState" => "UPLOADED"
             },
             %{
               "id" => processed_asset_id,
               "mimeType" => "image/jpeg",
               "processingState" => "PROCESSED"
             }
           ]
  end

  test "post query does not expose owner-scoped media fields through mediaAssets" do
    author = user_fixture()

    assert {:ok, uploaded_asset} =
             Content.create_media_asset(author, %{
               storage_key: "uploads/users/#{author.id}/story-private.jpg",
               mime_type: "image/jpeg",
               processing_state: :uploaded
             })

    {:ok, post} =
      Content.create_post(author, %{
        kind: :story,
        body_text: "story post",
        visibility: :public,
        media_asset_ids: [uploaded_asset.id]
      })

    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      post(id: $id) {
        mediaAssets {
          ownerId
          storageKey
        }
      }
    }
    """

    assert {:ok, %{errors: errors}} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

    assert Enum.sort(Enum.map(errors, & &1.message)) == [
             "Cannot query field \"ownerId\" on type \"PostMediaAsset\".",
             "Cannot query field \"storageKey\" on type \"PostMediaAsset\"."
           ]
  end

  test "post query returns null for expired story posts even with a valid public ID" do
    author = user_fixture()
    viewer = user_fixture()
    viewer_context = %{current_scope: Accounts.scope_for_user(viewer)}

    {:ok, story_post} =
      Content.create_post(author, %{kind: :story, body_text: "expired story", visibility: :public})

    expired_at = ~U[2026-03-18 17:00:00.000000Z]

    {1, _rows} =
      Repo.update_all(from(post in Post, where: post.id == ^story_post.id),
        set: [expires_at: expired_at, updated_at: expired_at]
      )

    post_id = Absinthe.Relay.Node.to_global_id(:post, story_post.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      post(id: $id) {
        id
      }
    }
    """

    assert {:ok, %{data: %{"post" => nil}}} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

    assert {:ok, %{data: %{"post" => nil}}} =
             Absinthe.run(query, LCGQL.Schema,
               variables: %{"id" => post_id},
               context: viewer_context
             )
  end

  test "post query returns null for follower-only posts without viewer visibility" do
    author = user_fixture()
    outsider = user_fixture()
    outsider_context = %{current_scope: Accounts.scope_for_user(outsider)}

    {:ok, post} =
      Content.create_post(author, %{kind: :standard, body_text: "followers only"})

    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    query = """
    query($id: ID!) {
      post(id: $id) {
        id
      }
    }
    """

    assert {:ok, %{data: %{"post" => nil}}} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"id" => post_id})

    assert {:ok, %{data: %{"post" => nil}}} =
             Absinthe.run(query, LCGQL.Schema,
               variables: %{"id" => post_id},
               context: outsider_context
             )
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
        publicUrl
      }
    }
    """

    assert {:ok, expected_public_url} =
             LC.Infra.ObjectStorage.public_asset_url(media_asset.storage_key)

    assert {:ok,
            %{
              data: %{
                "mediaAsset" => %{
                  "id" => returned_media_asset_id,
                  "mimeType" => "image/jpeg",
                  "processingState" => "PENDING_UPLOAD",
                  "publicUrl" => returned_public_url
                }
              }
            }} =
             Absinthe.run(query, LCGQL.Schema,
               variables: %{"id" => media_asset_id},
               context: context
             )

    assert returned_media_asset_id == media_asset_id
    assert returned_public_url == expected_public_url
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
             Absinthe.run(query, LCGQL.Schema,
               variables: %{"id" => media_asset_id},
               context: context
             )
  end
end
