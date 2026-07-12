defmodule LCWeb.ContactInviteControllerTest do
  use LCWeb.ConnCase

  @raw_token "01901234-5678-7abc-8def-0123456789ab.raw_secret"
  @endpoint_stop_event [:phoenix, :endpoint, :stop]

  test "GET /invites renders a neutral no-store landing page without receiving the fragment token",
       %{conn: conn} do
    test_pid = self()
    handler_id = {__MODULE__, make_ref()}

    :ok =
      :telemetry.attach(
        handler_id,
        @endpoint_stop_event,
        fn _event, _measurements, metadata, _config ->
          send(test_pid, {:endpoint_request_path, metadata.conn.request_path})
        end,
        nil
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    delivery_url =
      "https://app.livecanvas.example/invites#token=#{URI.encode_www_form(@raw_token)}"

    request_path = URI.parse(delivery_url).path
    conn = get(conn, request_path)
    body = html_response(conn, 200)

    assert get_resp_header(conn, "cache-control") == ["no-store"]
    assert get_resp_header(conn, "referrer-policy") == ["no-referrer"]

    assert get_resp_header(conn, "content-security-policy") == [
             "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
           ]

    assert body =~ "Open this invite in LiveCanvas"
    assert body =~ "This invite is invalid or expired."
    assert body =~ "data-contact-invite-landing"
    refute body =~ @raw_token

    assert_receive {:endpoint_request_path, endpoint_path}
    assert endpoint_path == "/invites"
    refute endpoint_path =~ @raw_token
  end

  test "the public HTML router pipeline does not fetch a session or resolve a viewer scope" do
    session_fetch = fn _conn -> flunk("the public invite pipeline fetched the session") end

    conn =
      Plug.Test.conn(:get, "/invites")
      |> put_private(:phoenix_endpoint, LCWeb.Endpoint)
      |> put_private(:plug_session_fetch, session_fetch)
      |> LCWeb.Router.call(LCWeb.Router.init([]))

    assert html_response(conn, 200) =~ "Open this invite in LiveCanvas"
    assert conn.private.plug_session_fetch === session_fetch
    refute Map.has_key?(conn.assigns, :current_scope)
  end

  test "the endpoint does not run GraphQL context for the public invite landing", %{conn: conn} do
    conn = get(conn, ~p"/invites")

    assert is_function(conn.private.plug_session_fetch, 1)
    refute Map.has_key?(conn.assigns, :current_scope)
    refute Map.has_key?(conn.private, :absinthe)
  end

  test "GET /invites renders the same neutral page for unrelated query values", %{conn: conn} do
    first_body = conn |> get(~p"/invites") |> html_response(200)
    second_body = conn |> recycle() |> get(~p"/invites?source=unknown") |> html_response(200)

    assert first_body == second_body
  end

  test "does not expose a legacy token path", %{conn: conn} do
    conn = get(conn, "/invites/#{@raw_token}")
    assert response(conn, 404)
  end

  test "invalid and missing production public origins fail runtime configuration" do
    runtime_config = Path.expand("../../../config/runtime.exs", __DIR__)
    original_origin = System.get_env("LIVE_CANVAS_PUBLIC_ORIGIN")

    on_exit(fn -> restore_env("LIVE_CANVAS_PUBLIC_ORIGIN", original_origin) end)

    for invalid_origin <- [
          "http://app.livecanvas.example",
          "https://",
          "https://livecanvas.invalid",
          "https://placeholder.invalid/",
          "https://app.livecanvas.example/invites",
          "https://app.livecanvas.example?token=visible",
          "https://app.livecanvas.example#token=visible"
        ] do
      System.put_env("LIVE_CANVAS_PUBLIC_ORIGIN", invalid_origin)

      assert_raise RuntimeError, ~r/LIVE_CANVAS_PUBLIC_ORIGIN.*absolute HTTPS origin/s, fn ->
        Config.Reader.read!(runtime_config, env: :prod, target: :host)
      end
    end

    System.delete_env("LIVE_CANVAS_PUBLIC_ORIGIN")

    assert_raise RuntimeError, ~r/LIVE_CANVAS_PUBLIC_ORIGIN.*required/s, fn ->
      Config.Reader.read!(runtime_config, env: :prod, target: :host)
    end
  end

  test "production public origin normalizes one trailing slash" do
    runtime_config = Path.expand("../../../config/runtime.exs", __DIR__)

    put_runtime_env(%{
      "LIVE_CANVAS_PUBLIC_ORIGIN" => "https://app.livecanvas.example/"
    })

    config = Config.Reader.read!(runtime_config, env: :prod, target: :host)

    assert config
           |> Keyword.fetch!(:live_canvas)
           |> Keyword.fetch!(:public_app_origin) == "https://app.livecanvas.example"
  end

  defp put_runtime_env(overrides) do
    values =
      Map.merge(
        %{
          "APPLE_OIDC_AUDIENCES" => "apple-client",
          "DATABASE_URL" => "ecto://postgres:postgres@localhost/live_canvas",
          "GOOGLE_OIDC_AUDIENCES" => "google-client",
          "OBJECT_STORAGE_PUBLIC_BASE_URL" => "https://cdn.livecanvas.example",
          "OBJECT_STORAGE_UPLOAD_SIGNING_URL" =>
            "https://storage.livecanvas.example/upload-tickets",
          "OBJECT_STORAGE_VERIFICATION_BASE_URL" => "https://storage.livecanvas.example/objects",
          "SECRET_KEY_BASE" => String.duplicate("a", 64)
        },
        overrides
      )

    originals = Map.new(values, fn {name, _value} -> {name, System.get_env(name)} end)
    Enum.each(values, fn {name, value} -> System.put_env(name, value) end)
    on_exit(fn -> Enum.each(originals, fn {name, value} -> restore_env(name, value) end) end)
  end

  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)
end
