defmodule LC.Infra.ObjectStorage.FakeAdapterTest do
  use ExUnit.Case, async: true

  alias LC.Infra.ObjectStorage

  test "returns deterministic signed-upload details" do
    assert {:ok, signed_upload} =
             ObjectStorage.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })

    assert signed_upload.method == :put
    assert signed_upload.url == "https://object-storage.invalid/uploads/users/7/media.jpg"
    assert signed_upload.headers["content-type"] == "image/jpeg"
    assert %DateTime{} = signed_upload.expires_at
  end

  test "rejects invalid upload requests" do
    assert {:error, :invalid_upload_request} =
             ObjectStorage.sign_upload(%{mime_type: "image/jpeg"})
  end

  test "builds a deterministic public asset URL from storage key" do
    assert {:ok, public_url} = ObjectStorage.public_asset_url("uploads/users/7/media.jpg")
    assert public_url == "https://object-storage.invalid/uploads/users/7/media.jpg"
  end
end
