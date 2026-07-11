defmodule LC.Infra.ObjectStorage.ConfigurableAdapterTest do
  use ExUnit.Case, async: false

  alias LC.Infra.ObjectStorage.ConfigurableAdapter

  setup do
    previous = Application.get_env(:live_canvas, ConfigurableAdapter)

    Application.put_env(:live_canvas, ConfigurableAdapter,
      upload_base_url: "https://uploads.example.test/direct",
      verification_base_url: "https://verify.example.test/objects",
      verification_authorization_header: "Bearer server-only",
      verification_request_options: [plug: {Req.Test, ConfigurableAdapter}],
      public_base_url: "https://cdn.example.test/assets",
      upload_ttl_seconds: 600
    )

    Req.Test.verify_on_exit!()

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

    assert upload.headers == %{
             "content-type" => "image/jpeg",
             "if-none-match" => "*"
           }

    assert %DateTime{} = upload.expires_at
  end

  test "verify_upload/1 performs an authorized HEAD against the private verification origin" do
    Req.Test.expect(ConfigurableAdapter, fn conn ->
      assert conn.method == "HEAD"
      assert conn.request_path == "/objects/uploads/users/7/media.jpg"
      assert Plug.Conn.get_req_header(conn, "authorization") == ["Bearer server-only"]

      conn
      |> Plug.Conn.put_resp_header("content-type", "image/jpeg; charset=binary")
      |> Plug.Conn.put_resp_header("content-length", "1024")
      |> Plug.Conn.send_resp(200, "")
    end)

    assert {:ok, %{content_length: 1024, content_type: "image/jpeg"}} =
             ConfigurableAdapter.verify_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg",
               max_bytes: 25 * 1024 * 1024
             })
  end

  test "verify_upload/1 rejects missing, empty, oversized, and mismatched objects" do
    cases = [
      {200, [{"content-type", "image/jpeg"}], :invalid_content_length},
      {200, [{"content-type", "image/jpeg"}, {"content-length", "garbage"}],
       :invalid_content_length},
      {200, [{"content-type", "image/jpeg"}, {"content-length", "-1"}], :invalid_content_length},
      {200, [{"content-type", "image/jpeg"}, {"content-length", "0"}], :empty_upload},
      {200, [{"content-type", "image/jpeg"}, {"content-length", "11"}], :upload_too_large},
      {200, [{"content-type", "video/mp4"}, {"content-length", "10"}], :content_type_mismatch},
      {404, [], :upload_not_found},
      {503, [], :storage_unavailable}
    ]

    for {status, headers, expected_error} <- cases do
      Req.Test.expect(ConfigurableAdapter, fn conn ->
        conn =
          Enum.reduce(headers, conn, fn {name, value}, acc ->
            Plug.Conn.put_resp_header(acc, name, value)
          end)

        Plug.Conn.send_resp(conn, status, "")
      end)

      assert {:error, ^expected_error} =
               ConfigurableAdapter.verify_upload(%{
                 key: "uploads/users/7/media.jpg",
                 mime_type: "image/jpeg",
                 max_bytes: 10
               })
    end
  end

  test "verify_upload/1 maps transport failures to storage unavailable" do
    Req.Test.expect(ConfigurableAdapter, &Req.Test.transport_error(&1, :timeout))

    assert {:error, :storage_unavailable} =
             ConfigurableAdapter.verify_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg",
               max_bytes: 10
             })
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
      verification_base_url: "https://verify.example.test/objects",
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
      verification_base_url: "https://verify.example.test/objects",
      public_base_url: "https://cdn.example.test/assets#v2",
      upload_ttl_seconds: 600
    )

    assert {:error, :invalid_config} =
             ConfigurableAdapter.public_asset_url("uploads/users/7/media.jpg")
  end
end
