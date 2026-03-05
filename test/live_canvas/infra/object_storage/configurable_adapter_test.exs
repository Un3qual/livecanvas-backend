defmodule LC.Infra.ObjectStorage.ConfigurableAdapterTest do
  use ExUnit.Case, async: false

  alias LC.Infra.ObjectStorage.ConfigurableAdapter

  setup do
    previous = Application.get_env(:live_canvas, ConfigurableAdapter)

    Application.put_env(:live_canvas, ConfigurableAdapter,
      upload_base_url: "https://uploads.example.test/direct",
      public_base_url: "https://cdn.example.test/assets",
      upload_ttl_seconds: 600
    )

    on_exit(fn ->
      if previous do
        Application.put_env(:live_canvas, ConfigurableAdapter, previous)
      else
        Application.delete_env(:live_canvas, ConfigurableAdapter)
      end
    end)

    :ok
  end

  test "sign_upload/1 builds configured direct-upload URLs" do
    assert {:ok, upload} =
             ConfigurableAdapter.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })

    assert upload.method == :put
    assert upload.url == "https://uploads.example.test/direct/uploads/users/7/media.jpg"
    assert upload.headers == %{"content-type" => "image/jpeg"}
    assert %DateTime{} = upload.expires_at
  end

  test "public_asset_url/1 builds configured serving URLs" do
    assert {:ok, url} = ConfigurableAdapter.public_asset_url("uploads/users/7/media.jpg")

    assert url == "https://cdn.example.test/assets/uploads/users/7/media.jpg"
  end

  test "rejects invalid storage keys" do
    assert {:error, :invalid_storage_key} = ConfigurableAdapter.public_asset_url("../secret")
  end

  test "rejects upload base URLs with query components" do
    Application.put_env(:live_canvas, ConfigurableAdapter,
      upload_base_url: "https://uploads.example.test/direct?token=abc",
      public_base_url: "https://cdn.example.test/assets",
      upload_ttl_seconds: 600
    )

    assert {:error, :invalid_config} =
             ConfigurableAdapter.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })
  end

  test "rejects public base URLs with fragment components" do
    Application.put_env(:live_canvas, ConfigurableAdapter,
      upload_base_url: "https://uploads.example.test/direct",
      public_base_url: "https://cdn.example.test/assets#v2",
      upload_ttl_seconds: 600
    )

    assert {:error, :invalid_config} =
             ConfigurableAdapter.public_asset_url("uploads/users/7/media.jpg")
  end
end
