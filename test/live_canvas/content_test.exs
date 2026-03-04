defmodule LC.ContentTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Content
  alias LCSchemas.Infra.AsyncJob

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
    test "finalizes a viewer-owned pending upload and enqueues async processing" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert asset.processing_state == :pending_upload

      assert {:ok, finalized_asset} =
               Content.finalize_media_upload(owner, asset.id, %{width: 1080, height: 1920})

      assert finalized_asset.id == asset.id
      assert finalized_asset.processing_state == :uploaded
      assert finalized_asset.width == 1080
      assert finalized_asset.height == 1920

      assert Repo.aggregate(AsyncJob, :count, :id) == 1

      async_job = Repo.one!(AsyncJob)
      assert async_job.kind == "media_asset_processing"
      assert async_job.payload == %{"media_asset_id" => asset.id}
      assert async_job.dedupe_key == "media_asset_processing:#{asset.id}"
      assert async_job.max_attempts == 2
    end

    test "returns not found for non-owners" do
      owner = user_fixture()
      other_user = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:error, :not_found} = Content.finalize_media_upload(other_user, asset.id, %{})
    end

    test "is idempotent when finalize is called repeatedly for the same upload" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:ok, uploaded_asset} = Content.finalize_media_upload(owner, asset.id, %{})
      assert uploaded_asset.processing_state == :uploaded

      assert {:ok, uploaded_asset_again} = Content.finalize_media_upload(owner, asset.id, %{})
      assert uploaded_asset_again.id == uploaded_asset.id
      assert uploaded_asset_again.processing_state == :uploaded

      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end

    test "enqueues async processing for already-uploaded rows during finalize recovery" do
      owner = user_fixture()

      assert {:ok, uploaded_asset} =
               Content.create_media_asset(owner, %{
                 storage_key: "uploads/users/#{owner.id}/already-uploaded.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :uploaded
               })

      assert {:ok, finalized_asset} = Content.finalize_media_upload(owner, uploaded_asset.id, %{})
      assert finalized_asset.processing_state == :uploaded
      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end
  end
end
