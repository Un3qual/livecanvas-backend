defmodule LCWeb.MagicLinkControllerTest do
  use LCWeb.ConnCase

  @raw_token "01901234-5678-7abc-8def-0123456789ab.raw_secret"
  @endpoint_stop_event [:phoenix, :endpoint, :stop]

  for {purpose, path} <- [
        sign_in: "/auth/magic-link/sign-in",
        sign_up: "/auth/magic-link/sign-up"
      ] do
    @purpose purpose
    @path path

    test "GET #{@path} renders a neutral hardened landing without receiving the fragment token",
         %{conn: conn} do
      test_pid = self()
      handler_id = {__MODULE__, @purpose, make_ref()}

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
        "https://app.livecanvas.example#{@path}#token=#{URI.encode_www_form(@raw_token)}"

      conn = get(conn, URI.parse(delivery_url).path)
      body = html_response(conn, 200)

      assert get_resp_header(conn, "cache-control") == ["no-store"]
      assert get_resp_header(conn, "referrer-policy") == ["no-referrer"]

      assert get_resp_header(conn, "content-security-policy") == [
               "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
             ]

      assert body =~ "Open your LiveCanvas email link"
      assert body =~ "This email link is invalid or expired."
      assert body =~ "data-magic-link-landing"
      assert body =~ ~s(src="/assets/js/magic_link_landing_entry.js")
      refute body =~ ~s(src="/assets/js/app.js")
      refute body =~ ~s(name="csrf-token")
      refute body =~ @raw_token

      assert_receive {:endpoint_request_path, endpoint_path}
      assert endpoint_path == @path
      refute endpoint_path =~ @raw_token
    end
  end

  test "the public landing pipeline does not fetch a session or resolve a viewer scope" do
    session_fetch = fn _conn -> flunk("the public magic-link pipeline fetched the session") end

    conn =
      Plug.Test.conn(:get, "/auth/magic-link/sign-in")
      |> put_private(:phoenix_endpoint, LCWeb.Endpoint)
      |> put_private(:plug_session_fetch, session_fetch)
      |> LCWeb.Router.call(LCWeb.Router.init([]))

    assert html_response(conn, 200) =~ "Open your LiveCanvas email link"
    assert conn.private.plug_session_fetch === session_fetch
    refute Map.has_key?(conn.assigns, :current_scope)
    refute Map.has_key?(conn.private, :absinthe)
  end

  test "does not expose token-bearing or arbitrary-purpose paths", %{conn: conn} do
    assert conn |> get("/auth/magic-link/#{@raw_token}") |> response(404)
    assert conn |> recycle() |> get("/auth/magic-link/other") |> response(404)
  end
end
