defmodule LC.Infra.ObjectStorage.FakeAdapterTest do
  use ExUnit.Case, async: true

  alias LC.Infra.ObjectStorage
  alias LC.Infra.ObjectStorage.FakeAdapter

  test "returns deterministic signed-upload details" do
    assert {:ok, signed_upload} =
             ObjectStorage.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })

    assert signed_upload.method == :put
    assert signed_upload.url == "https://object-storage.invalid/uploads/users/7/media.jpg"
    assert signed_upload.headers["content-type"] == "image/jpeg"
    assert signed_upload.headers["if-none-match"] == "*"
    assert %DateTime{} = signed_upload.expires_at
  end

  test "fake uploads are write-once and expose verified object metadata" do
    request = %{
      key: "uploads/users/7/write-once.jpg",
      mime_type: "image/jpeg",
      content_length: 1024
    }

    assert :ok = FakeAdapter.put_object(request)
    assert {:error, :precondition_failed} = FakeAdapter.put_object(request)

    assert {:ok, %{content_length: 1024, content_type: "image/jpeg"}} =
             ObjectStorage.verify_upload(%{
               key: request.key,
               mime_type: request.mime_type,
               max_bytes: 25 * 1024 * 1024
             })
  end

  test "verification rejects absent, empty, oversized, and mismatched fake objects" do
    key = "uploads/users/7/verification.jpg"

    assert {:error, :upload_not_found} =
             ObjectStorage.verify_upload(%{
               key: key,
               mime_type: "image/jpeg",
               max_bytes: 10
             })

    assert :ok = FakeAdapter.put_object(%{key: key, mime_type: "image/jpeg", content_length: 0})

    assert {:error, :empty_upload} =
             ObjectStorage.verify_upload(%{key: key, mime_type: "image/jpeg", max_bytes: 10})

    oversized_key = "uploads/users/7/oversized.jpg"

    assert :ok =
             FakeAdapter.put_object(%{
               key: oversized_key,
               mime_type: "image/jpeg",
               content_length: 11
             })

    assert {:error, :upload_too_large} =
             ObjectStorage.verify_upload(%{
               key: oversized_key,
               mime_type: "image/jpeg",
               max_bytes: 10
             })

    mismatch_key = "uploads/users/7/mismatch.jpg"

    assert :ok =
             FakeAdapter.put_object(%{
               key: mismatch_key,
               mime_type: "video/mp4",
               content_length: 10
             })

    assert {:error, :content_type_mismatch} =
             ObjectStorage.verify_upload(%{
               key: mismatch_key,
               mime_type: "image/jpeg",
               max_bytes: 10
             })
  end

  test "rejects invalid upload requests" do
    assert {:error, :invalid_upload_request} =
             ObjectStorage.sign_upload(%{mime_type: "image/jpeg"})
  end

  test "rejects invalid verification requests" do
    assert {:error, :invalid_verification_request} =
             ObjectStorage.verify_upload(%{mime_type: "image/jpeg", max_bytes: 10})
  end

  test "builds a deterministic public asset URL from storage key" do
    assert {:ok, public_url} = ObjectStorage.public_asset_url("uploads/users/7/media.jpg")
    assert public_url == "https://object-storage.invalid/uploads/users/7/media.jpg"
  end
end
