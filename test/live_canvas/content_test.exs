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
end
