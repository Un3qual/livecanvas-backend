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
end
