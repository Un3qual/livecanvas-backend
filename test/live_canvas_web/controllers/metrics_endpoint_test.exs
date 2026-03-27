defmodule LCWeb.MetricsEndpointTest do
  use LCWeb.ConnCase, async: false

  @metrics_config_module LCWeb.Plugs.MetricsAuth
  @valid_token "test-metrics-token"

  setup do
    original_config = Application.get_env(:live_canvas, @metrics_config_module)

    on_exit(fn ->
      restore_metrics_config(original_config)
    end)

    :ok
  end

  describe "GET /ops/metrics" do
    test "returns 404 when the metrics endpoint is disabled", %{conn: conn} do
      put_metrics_config(enabled: false, token: @valid_token)

      conn = get(conn, "/ops/metrics")

      assert conn.status == 404
    end

    test "returns 401 when the metrics endpoint is enabled without a valid bearer token", %{
      conn: conn
    } do
      put_metrics_config(enabled: true, token: @valid_token)

      conn = get(conn, "/ops/metrics")

      assert response(conn, 401) == "invalid_metrics_token"
    end

    test "returns Prometheus text output for authorized scrapes when enabled", %{conn: conn} do
      put_metrics_config(enabled: true, token: @valid_token)

      :telemetry.execute(
        [:live_canvas, :live, :session, :start],
        %{count: 1},
        %{result: :ok, reason: :none}
      )

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{@valid_token}")
        |> get("/ops/metrics")

      assert response(conn, 200) =~ "live_canvas_live_session_start_count{"
      assert hd(get_resp_header(conn, "content-type")) =~ "text/plain"
    end
  end

  defp put_metrics_config(overrides) do
    Application.put_env(
      :live_canvas,
      @metrics_config_module,
      Keyword.merge([enabled: false, token: nil], overrides)
    )
  end

  defp restore_metrics_config(nil), do: Application.delete_env(:live_canvas, @metrics_config_module)

  defp restore_metrics_config(original_config) when is_list(original_config) do
    Application.put_env(:live_canvas, @metrics_config_module, original_config)
  end
end
