defmodule LC.Infra.ObjectStorage.ConfigurableAdapterTest do
  use ExUnit.Case, async: false

  alias LC.Infra.ObjectStorage.ConfigurableAdapter

  setup do
    previous = Application.get_env(:live_canvas, ConfigurableAdapter)

    Application.put_env(:live_canvas, ConfigurableAdapter,
      upload_signing_url: "https://signer.example.test/upload-tickets",
      upload_signing_authorization_header: "Bearer signer-only",
      upload_signing_request_options: [plug: {Req.Test, ConfigurableAdapter}],
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

  test "sign_upload/1 requests an authenticated write-once upload ticket" do
    expect_upload_ticket()

    assert {:ok, upload} =
             ConfigurableAdapter.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })

    assert upload.method == :put

    assert upload.url ==
             "https://uploads.example.test/objects/uploads/users/7/media.jpg?ticket=bound"

    assert upload.headers == %{
             "content-type" => "image/jpeg",
             "if-none-match" => "*"
           }

    assert %DateTime{} = upload.expires_at
  end

  test "the upload ticket accepts the exact signed request once and rejects bypass or overwrite" do
    expect_upload_ticket()

    assert {:ok, upload} =
             ConfigurableAdapter.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })

    {:ok, writes} = Agent.start_link(fn -> MapSet.new() end)

    Req.Test.stub(__MODULE__.UploadGateway, fn conn ->
      has_bound_ticket = conn.query_string == "ticket=bound"
      has_content_type = Plug.Conn.get_req_header(conn, "content-type") == ["image/jpeg"]
      has_create_only = Plug.Conn.get_req_header(conn, "if-none-match") == ["*"]

      cond do
        not (has_bound_ticket and has_content_type and has_create_only) ->
          Plug.Conn.send_resp(conn, 403, "signature mismatch")

        Agent.get_and_update(writes, fn written_paths ->
          if MapSet.member?(written_paths, conn.request_path) do
            {true, written_paths}
          else
            {false, MapSet.put(written_paths, conn.request_path)}
          end
        end) ->
          Plug.Conn.send_resp(conn, 412, "already exists")

        true ->
          Plug.Conn.send_resp(conn, 201, "created")
      end
    end)

    bypass_response =
      Req.put!(
        url: upload.url,
        headers: Map.delete(upload.headers, "if-none-match"),
        body: "first",
        plug: {Req.Test, __MODULE__.UploadGateway}
      )

    first_response =
      Req.put!(
        url: upload.url,
        headers: upload.headers,
        body: "first",
        plug: {Req.Test, __MODULE__.UploadGateway}
      )

    overwrite_response =
      Req.put!(
        url: upload.url,
        headers: upload.headers,
        body: "second",
        plug: {Req.Test, __MODULE__.UploadGateway}
      )

    assert bypass_response.status == 403
    assert first_response.status == 201
    assert overwrite_response.status == 412
  end

  test "sign_upload/1 rejects tickets that do not bind the create-only header" do
    Req.Test.expect(ConfigurableAdapter, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(body)

      Req.Test.json(conn, %{
        method: "PUT",
        url: "https://uploads.example.test/object?ticket=unbound",
        headers: %{"content-type" => "image/jpeg"},
        expires_at: payload["expires_at"]
      })
    end)

    assert {:error, :invalid_upload_ticket} =
             ConfigurableAdapter.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })
  end

  test "sign_upload/1 rejects tickets that change the requested upload method" do
    Req.Test.expect(ConfigurableAdapter, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(body)

      Req.Test.json(conn, %{
        method: "POST",
        url: "https://uploads.example.test/object?ticket=wrong-method",
        headers: payload["required_headers"],
        expires_at: payload["expires_at"]
      })
    end)

    assert {:error, :invalid_upload_ticket} =
             ConfigurableAdapter.sign_upload(%{
               key: "uploads/users/7/media.jpg",
               mime_type: "image/jpeg"
             })
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

  test "rejects upload signing URLs with query components" do
    Application.put_env(:live_canvas, ConfigurableAdapter,
      upload_signing_url: "https://signer.example.test/tickets?token=abc",
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
      upload_signing_url: "https://signer.example.test/tickets",
      verification_base_url: "https://verify.example.test/objects",
      public_base_url: "https://cdn.example.test/assets#v2",
      upload_ttl_seconds: 600
    )

    assert {:error, :invalid_config} =
             ConfigurableAdapter.public_asset_url("uploads/users/7/media.jpg")
  end

  defp expect_upload_ticket do
    Req.Test.expect(ConfigurableAdapter, fn conn ->
      assert conn.method == "POST"
      assert conn.request_path == "/upload-tickets"
      assert Plug.Conn.get_req_header(conn, "authorization") == ["Bearer signer-only"]

      {:ok, body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(body)

      assert payload["key"] == "uploads/users/7/media.jpg"
      assert payload["method"] == "PUT"
      assert payload["content_type"] == "image/jpeg"
      assert payload["write_once"] == true

      assert payload["required_headers"] == %{
               "content-type" => "image/jpeg",
               "if-none-match" => "*"
             }

      Req.Test.json(conn, %{
        method: "PUT",
        url: "https://uploads.example.test/objects/uploads/users/7/media.jpg?ticket=bound",
        headers: payload["required_headers"],
        expires_at: payload["expires_at"]
      })
    end)
  end
end
