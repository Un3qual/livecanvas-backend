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

  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)
end
