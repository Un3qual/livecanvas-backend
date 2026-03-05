defmodule LCGQL.Content.ContentMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Content}

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

  test "requestMediaUpload returns upload instructions for the authenticated viewer" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($mimeType: String!) {
      requestMediaUpload(input: {mimeType: $mimeType}) {
        mediaAsset {
          id
          mimeType
          processingState
        }
        signedUpload {
          method
          url
          expiresAt
          headers {
            name
            value
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
                "requestMediaUpload" => %{
                  "mediaAsset" => %{
                    "id" => media_asset_id,
                    "mimeType" => "image/jpeg",
                    "processingState" => "PENDING_UPLOAD"
                  },
                  "signedUpload" => %{
                    "method" => "PUT",
                    "url" => upload_url,
                    "expiresAt" => expires_at,
                    "headers" => [%{"name" => "content-type", "value" => "image/jpeg"}]
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"mimeType" => "image/jpeg"},
               context: context
             )

    assert is_binary(media_asset_id)
    assert is_binary(upload_url)
    assert upload_url =~ "object-storage.invalid/uploads/users/"
    assert is_binary(expires_at)
  end

  test "requestMediaUpload returns unauthenticated errors without a viewer scope" do
    mutation = """
    mutation($mimeType: String!) {
      requestMediaUpload(input: {mimeType: $mimeType}) {
        mediaAsset {
          id
        }
        signedUpload {
          method
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
                "requestMediaUpload" => %{
                  "mediaAsset" => nil,
                  "signedUpload" => nil,
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"mimeType" => "image/jpeg"})
  end

  test "updatePost updates a viewer-owned post" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}
    {:ok, post} = Content.create_post(viewer, %{kind: :standard, body_text: "before"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!, $bodyText: String!) {
      updatePost(input: {postId: $postId, bodyText: $bodyText, visibility: PUBLIC}) {
        post {
          id
          bodyText
          visibility
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
                "updatePost" => %{
                  "post" => %{
                    "id" => returned_post_id,
                    "bodyText" => "after",
                    "visibility" => "PUBLIC"
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => post_id, "bodyText" => "after"},
               context: context
             )

    assert returned_post_id == post_id
  end

  test "updatePost returns ownership errors for posts outside viewer scope" do
    owner = user_fixture()
    other_viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(other_viewer)}
    {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "before"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!, $bodyText: String!) {
      updatePost(input: {postId: $postId, bodyText: $bodyText}) {
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
                "updatePost" => %{
                  "post" => nil,
                  "errors" => [%{"field" => "postId", "message" => "not_found"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => post_id, "bodyText" => "after"},
               context: context
             )
  end

  test "updatePost returns structured errors for non-global post IDs" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($postId: ID!, $bodyText: String!) {
      updatePost(input: {postId: $postId, bodyText: $bodyText}) {
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
                "updatePost" => %{
                  "post" => nil,
                  "errors" => [%{"field" => "postId", "message" => message}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => "123", "bodyText" => "after"},
               context: context
             )

    assert message =~ "invalid_id"
  end

  test "updatePost returns unauthenticated errors without a viewer scope" do
    viewer = user_fixture()
    {:ok, post} = Content.create_post(viewer, %{kind: :standard, body_text: "before"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!, $bodyText: String!) {
      updatePost(input: {postId: $postId, bodyText: $bodyText}) {
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
                "updatePost" => %{
                  "post" => nil,
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => post_id, "bodyText" => "after"}
             )
  end

  test "deletePost deletes a viewer-owned post and returns deleted node ID" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}
    {:ok, post} = Content.create_post(viewer, %{kind: :standard, body_text: "before"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!) {
      deletePost(input: {postId: $postId}) {
        deletedPostId
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
                "deletePost" => %{
                  "deletedPostId" => returned_post_id,
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => post_id},
               context: context
             )

    assert returned_post_id == post_id
    refute Content.get_post(post.id)
  end

  test "deletePost returns ownership errors for posts outside viewer scope" do
    owner = user_fixture()
    other_viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(other_viewer)}
    {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "before"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!) {
      deletePost(input: {postId: $postId}) {
        deletedPostId
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
                "deletePost" => %{
                  "deletedPostId" => nil,
                  "errors" => [%{"field" => "postId", "message" => "not_found"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => post_id},
               context: context
             )
  end

  test "deletePost returns structured errors for non-global post IDs" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($postId: ID!) {
      deletePost(input: {postId: $postId}) {
        deletedPostId
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
                "deletePost" => %{
                  "deletedPostId" => nil,
                  "errors" => [%{"field" => "postId", "message" => message}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => "123"},
               context: context
             )

    assert message =~ "invalid_id"
  end

  test "deletePost returns unauthenticated errors without a viewer scope" do
    viewer = user_fixture()
    {:ok, post} = Content.create_post(viewer, %{kind: :standard, body_text: "before"})
    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!) {
      deletePost(input: {postId: $postId}) {
        deletedPostId
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
                "deletePost" => %{
                  "deletedPostId" => nil,
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"postId" => post_id})
  end
end
