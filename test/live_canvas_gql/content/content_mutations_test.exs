defmodule LCGQL.Content.ContentMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.ContentFixtures, only: [media_asset_fixture: 2]

  alias LC.{Accounts, Content}
  alias LC.Infra.ObjectStorage.FakeAdapter
  alias LCSchemas.Infra.AsyncJob

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

  test "createPost creates a story with viewer-owned media attachments" do
    viewer = user_fixture()
    viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    first_asset =
      media_asset_fixture(viewer, %{
        storage_key: "uploads/users/#{viewer.id}/story-first.jpg",
        mime_type: "image/jpeg",
        processing_state: :processed
      })

    second_asset =
      media_asset_fixture(viewer, %{
        storage_key: "uploads/users/#{viewer.id}/story-second.jpg",
        mime_type: "image/jpeg",
        processing_state: :processed
      })

    first_asset_id = Absinthe.Relay.Node.to_global_id(:media_asset, first_asset.id, LCGQL.Schema)

    second_asset_id =
      Absinthe.Relay.Node.to_global_id(:media_asset, second_asset.id, LCGQL.Schema)

    mutation = """
    mutation($mediaAssetIds: [ID!]!) {
      createPost(input: {kind: STORY, bodyText: "story post", visibility: PUBLIC, mediaAssetIds: $mediaAssetIds}) {
        post {
          id
          kind
          bodyText
          author {
            id
          }
          mediaAssets {
            id
            mimeType
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
                    "kind" => "STORY",
                    "bodyText" => "story post",
                    "author" => %{"id" => returned_author_id},
                    "mediaAssets" => media_assets
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"mediaAssetIds" => [first_asset_id, second_asset_id]},
               context: context
             )

    assert is_binary(post_id)
    assert returned_author_id == viewer_id

    expected_media_assets = [
      %{"id" => first_asset_id, "mimeType" => "image/jpeg"},
      %{"id" => second_asset_id, "mimeType" => "image/jpeg"}
    ]

    assert Enum.sort_by(media_assets, & &1["id"]) ==
             Enum.sort_by(expected_media_assets, & &1["id"])
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

  test "createPost attaches only processed media" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($mediaAssetIds: [ID!]!) {
      createPost(input: {kind: STANDARD, bodyText: "state gate", mediaAssetIds: $mediaAssetIds}) {
        post { id }
        errors { field message }
      }
    }
    """

    for state <- [:pending_upload, :uploaded, :failed] do
      media_asset = media_asset_fixture(viewer, %{processing_state: state})

      media_asset_id =
        Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "createPost" => %{
                    "post" => nil,
                    "errors" => [
                      %{
                        "field" => "media_asset_ids",
                        "message" => "must reference viewer-owned processed assets"
                      }
                    ]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mediaAssetIds" => [media_asset_id]},
                 context: context
               )
    end

    processed_asset = media_asset_fixture(viewer, %{processing_state: :processed})

    processed_asset_id =
      Absinthe.Relay.Node.to_global_id(:media_asset, processed_asset.id, LCGQL.Schema)

    assert {:ok,
            %{
              data: %{
                "createPost" => %{"post" => %{"id" => post_id}, "errors" => []}
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"mediaAssetIds" => [processed_asset_id]},
               context: context
             )

    assert is_binary(post_id)
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
                    "headers" => [
                      %{"name" => "content-type", "value" => "image/jpeg"},
                      %{"name" => "if-none-match", "value" => "*"}
                    ]
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

  test "requestMediaUpload enforces the shared MIME allowlist" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($mimeType: String!) {
      requestMediaUpload(input: {mimeType: $mimeType}) {
        mediaAsset { mimeType }
        errors { field message }
      }
    }
    """

    for mime_type <- ["image/jpeg", "image/png", "image/webp", "video/mp4"] do
      assert {:ok,
              %{
                data: %{
                  "requestMediaUpload" => %{
                    "mediaAsset" => %{"mimeType" => ^mime_type},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mimeType" => mime_type},
                 context: context
               )
    end

    for mime_type <- ["image/gif", "video/quicktime", "application/octet-stream"] do
      assert {:ok,
              %{
                data: %{
                  "requestMediaUpload" => %{
                    "mediaAsset" => nil,
                    "errors" => [%{"field" => "mime_type", "message" => "is not supported"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mimeType" => mime_type},
                 context: context
               )
    end
  end

  test "finalizeMediaUpload verifies storage and enqueues processing" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    assert {:ok, %{media_asset: media_asset}} =
             Content.request_media_upload(viewer, %{mime_type: "image/jpeg"})

    assert :ok =
             FakeAdapter.put_object(%{
               key: media_asset.storage_key,
               mime_type: media_asset.mime_type,
               content_length: 1024
             })

    media_asset_id =
      Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

    mutation = """
    mutation($mediaAssetId: ID!) {
      finalizeMediaUpload(input: {mediaAssetId: $mediaAssetId}) {
        mediaAsset { id processingState publicUrl }
        errors { field message }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "finalizeMediaUpload" => %{
                  "mediaAsset" => %{
                    "id" => ^media_asset_id,
                    "processingState" => "UPLOADED",
                    "publicUrl" => nil
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"mediaAssetId" => media_asset_id},
               context: context
             )

    assert Repo.aggregate(AsyncJob, :count, :id) == 1
  end

  test "finalizeMediaUpload is authenticated and hides foreign ownership" do
    owner = user_fixture()
    outsider = user_fixture()

    assert {:ok, %{media_asset: media_asset}} =
             Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

    media_asset_id =
      Absinthe.Relay.Node.to_global_id(:media_asset, media_asset.id, LCGQL.Schema)

    missing_id = Absinthe.Relay.Node.to_global_id(:media_asset, 9_999_999_999, LCGQL.Schema)

    mutation = """
    mutation($mediaAssetId: ID!) {
      finalizeMediaUpload(input: {mediaAssetId: $mediaAssetId}) {
        mediaAsset { id }
        errors { field message }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "finalizeMediaUpload" => %{
                  "mediaAsset" => nil,
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema, variables: %{"mediaAssetId" => media_asset_id})

    for id <- [media_asset_id, missing_id] do
      assert {:ok,
              %{
                data: %{
                  "finalizeMediaUpload" => %{
                    "mediaAsset" => nil,
                    "errors" => [%{"field" => "mediaAssetId", "message" => "not_found"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"mediaAssetId" => id},
                 context: %{current_scope: Accounts.scope_for_user(outsider)}
               )
    end
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

  test "updatePost returns a structured error for null visibility" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    {:ok, post} =
      Content.create_post(viewer, %{
        kind: :standard,
        body_text: "before",
        visibility: :public
      })

    post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

    mutation = """
    mutation($postId: ID!, $visibility: PostVisibility) {
      updatePost(input: {postId: $postId, visibility: $visibility}) {
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
                  "errors" => [%{"field" => "visibility", "message" => "can't be blank"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"postId" => post_id, "visibility" => nil},
               context: context
             )

    assert Content.get_post!(post.id).visibility == :public
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

  describe "reportPost" do
    test "creates an idempotent viewer-owned report for a visible post" do
      author = user_fixture()
      reporter = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(reporter)}

      {:ok, post} =
        Content.create_post(author, %{
          kind: :standard,
          body_text: "public abuse",
          visibility: :public
        })

      post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)
      reporter_id = Absinthe.Relay.Node.to_global_id(:user, reporter.id, LCGQL.Schema)

      mutation = """
      mutation($postId: ID!, $reason: PostReportReason!, $details: String) {
        reportPost(input: {postId: $postId, reason: $reason, details: $details}) {
          report {
            id
            postId
            reporterId
            reason
            status
            details
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
                  "reportPost" => %{
                    "report" => %{
                      "id" => report_id,
                      "postId" => ^post_id,
                      "reporterId" => ^reporter_id,
                      "reason" => "SPAM",
                      "status" => "OPEN",
                      "details" => "spammy post"
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{
                   "postId" => post_id,
                   "reason" => "SPAM",
                   "details" => "spammy post"
                 },
                 context: context
               )

      assert {:ok,
              %{
                data: %{
                  "reportPost" => %{
                    "report" => %{
                      "id" => ^report_id,
                      "reason" => "SPAM",
                      "details" => "spammy post"
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{
                   "postId" => post_id,
                   "reason" => "HARASSMENT",
                   "details" => "duplicate"
                 },
                 context: context
               )
    end

    test "returns stable errors for hidden, self-owned, invalid, and unauthenticated reports" do
      author = user_fixture()
      outsider = user_fixture()
      {:ok, hidden_post} = Content.create_post(author, %{kind: :standard, body_text: "hidden"})
      hidden_post_id = Absinthe.Relay.Node.to_global_id(:post, hidden_post.id, LCGQL.Schema)

      mutation = """
      mutation($postId: ID!) {
        reportPost(input: {postId: $postId, reason: OTHER}) {
          report {
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
                  "reportPost" => %{
                    "report" => nil,
                    "errors" => [%{"field" => "postId", "message" => "not_found"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"postId" => hidden_post_id},
                 context: %{current_scope: Accounts.scope_for_user(outsider)}
               )

      assert {:ok,
              %{
                data: %{
                  "reportPost" => %{
                    "report" => nil,
                    "errors" => [%{"field" => "postId", "message" => "own_post"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"postId" => hidden_post_id},
                 context: %{current_scope: Accounts.scope_for_user(author)}
               )

      assert {:ok,
              %{
                data: %{
                  "reportPost" => %{
                    "report" => nil,
                    "errors" => [%{"field" => "postId", "message" => invalid_id_message}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"postId" => "123"},
                 context: %{current_scope: Accounts.scope_for_user(outsider)}
               )

      assert invalid_id_message =~ "invalid_id"

      assert {:ok,
              %{
                data: %{
                  "reportPost" => %{
                    "report" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"postId" => hidden_post_id})
    end
  end

  describe "decidePostReport" do
    test "records a staff report decision with review metadata" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)

      {:ok, post} =
        Content.create_post(author, %{
          kind: :standard,
          body_text: "reported privately"
        })

      {:ok, report} = Content.report_post(reporter, post, %{reason: :spam})
      report_id = Absinthe.Relay.Node.to_global_id(:post_report, report.id, LCGQL.Schema)
      staff_id = Absinthe.Relay.Node.to_global_id(:user, staff.id, LCGQL.Schema)
      post_id = Absinthe.Relay.Node.to_global_id(:post, post.id, LCGQL.Schema)

      mutation = """
      mutation($reportId: ID!) {
        decidePostReport(input: {reportId: $reportId, status: DISMISSED, decisionNote: "not a violation"}) {
          report {
            id
            status
            decisionNote
            reviewedAt
            reviewedById
            post {
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
                  "decidePostReport" => %{
                    "report" => %{
                      "id" => ^report_id,
                      "status" => "DISMISSED",
                      "decisionNote" => "not a violation",
                      "reviewedAt" => reviewed_at,
                      "reviewedById" => ^staff_id,
                      "post" => %{"id" => ^post_id}
                    },
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"reportId" => report_id},
                 context: %{current_scope: Accounts.scope_for_user(staff)}
               )

      assert is_binary(reviewed_at)
    end

    test "returns structured errors for nonstaff and terminal transitions" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      nonstaff = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)

      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported"})
      {:ok, report} = Content.report_post(reporter, post, %{reason: :other})
      report_id = Absinthe.Relay.Node.to_global_id(:post_report, report.id, LCGQL.Schema)

      mutation = """
      mutation($reportId: ID!, $status: PostReportStatus!) {
        decidePostReport(input: {reportId: $reportId, status: $status}) {
          report {
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
                  "decidePostReport" => %{
                    "report" => nil,
                    "errors" => [%{"field" => nil, "message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"reportId" => report_id, "status" => "DISMISSED"},
                 context: %{current_scope: Accounts.scope_for_user(nonstaff)}
               )

      assert {:ok, _report} =
               Content.decide_post_report(Accounts.scope_for_user(staff), report.id, %{
                 status: :actioned
               })

      assert {:ok,
              %{
                data: %{
                  "decidePostReport" => %{
                    "report" => nil,
                    "errors" => [%{"field" => "reportId", "message" => "invalid_transition"}]
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"reportId" => report_id, "status" => "DISMISSED"},
                 context: %{current_scope: Accounts.scope_for_user(staff)}
               )
    end
  end
end
