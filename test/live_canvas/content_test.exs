defmodule LC.ContentTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Content

  describe "create_post/2" do
    test "persists author-owned content" do
      author = user_fixture()
      attrs = %{body_text: "first post", kind: :standard}

      assert {:ok, post} = Content.create_post(author, attrs)
      assert post.author_id == author.id
      assert post.kind == :standard
      assert post.body_text == "first post"
      assert post.visibility == :followers
      assert is_binary(post.entropy_id)
    end
  end

  describe "create_media_asset/2" do
    test "stores object metadata without binary payload fields" do
      author = user_fixture()

      assert {:ok, asset} =
               Content.create_media_asset(author, %{
                 storage_key: "uploads/a.jpg",
                 mime_type: "image/jpeg"
               })

      assert asset.owner_id == author.id
      assert asset.storage_key == "uploads/a.jpg"
      assert asset.mime_type == "image/jpeg"
      assert asset.processing_state == :uploaded
      assert is_binary(asset.entropy_id)
      refute :binary_payload in Map.keys(asset)
    end
  end

  describe "request_media_upload/2" do
    test "creates pending upload metadata with a server-generated storage key" do
      author = user_fixture()

      assert {:ok, %{media_asset: asset, upload: upload}} =
               Content.request_media_upload(author, %{
                 mime_type: "image/jpeg",
                 storage_key: "client-controlled.jpg"
               })

      assert asset.owner_id == author.id
      assert asset.mime_type == "image/jpeg"
      assert asset.processing_state == :pending_upload
      assert is_binary(asset.entropy_id)
      assert String.starts_with?(asset.storage_key, "uploads/users/#{author.id}/")
      refute asset.storage_key == "client-controlled.jpg"

      assert upload.method == :put
      assert upload.url == "https://object-storage.invalid/#{asset.storage_key}"
      assert upload.headers["content-type"] == "image/jpeg"
      assert %DateTime{} = upload.expires_at
    end

    test "returns changeset errors when mime type is missing" do
      author = user_fixture()

      assert {:error, %Ecto.Changeset{} = changeset} = Content.request_media_upload(author, %{})
      assert %{mime_type: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "finalize_media_upload/3" do
    test "finalizes a viewer-owned pending upload and marks it processed" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert asset.processing_state == :pending_upload

      assert {:ok, finalized_asset} =
               Content.finalize_media_upload(owner, asset.id, %{width: 1080, height: 1920})

      assert finalized_asset.id == asset.id
      assert finalized_asset.processing_state == :processed
      assert finalized_asset.width == 1080
      assert finalized_asset.height == 1920
    end

    test "returns not found for non-owners" do
      owner = user_fixture()
      other_user = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:error, :not_found} = Content.finalize_media_upload(other_user, asset.id, %{})
    end

    test "is idempotent when the upload is already processed" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:ok, processed_asset} = Content.finalize_media_upload(owner, asset.id, %{})
      assert processed_asset.processing_state == :processed

      assert {:ok, processed_asset_again} = Content.finalize_media_upload(owner, asset.id, %{})
      assert processed_asset_again.id == processed_asset.id
      assert processed_asset_again.processing_state == :processed
    end

    test "marks upload as failed when media processing rejects the MIME type" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "application/octet-stream"})

      assert {:error, :processing_failed} = Content.finalize_media_upload(owner, asset.id, %{})

      assert %{processing_state: :failed} = Content.get_user_media_asset(owner, asset.id)
    end
  end
end
