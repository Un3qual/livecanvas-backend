defmodule LCWeb.Plugs.ObservabilityContextTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias LCWeb.Plugs.ObservabilityContext

  @request_id "http-request-id-1234567890"
  @trace_id String.duplicate("a", 32)

  describe "call/2" do
    test "assigns request and trace correlation metadata without leaking auth headers" do
      conn =
        :get
        |> conn("/")
        |> put_req_header("authorization", "Bearer top-secret-token")
        |> Plug.RequestId.call(Plug.RequestId.init(assign_as: :request_id))
        |> ObservabilityContext.call([])

      assert %{request_id: request_id, trace_id: trace_id, viewer_id: nil, live_session_id: nil} =
               conn.assigns.observability_context

      assert request_id == conn.assigns.request_id
      assert trace_id =~ ~r/\A[0-9a-f]{32}\z/
      assert get_resp_header(conn, "x-trace-id") == [trace_id]
      assert Logger.metadata()[:request_id] == request_id
      assert Logger.metadata()[:trace_id] == trace_id
      refute Map.has_key?(conn.assigns.observability_context, :token)
      refute inspect(conn.assigns.observability_context) =~ "top-secret-token"
    end

    test "reuses a caller-provided trace id when it is already valid" do
      conn =
        :get
        |> conn("/")
        |> put_req_header("x-request-id", @request_id)
        |> put_req_header("x-trace-id", @trace_id)
        |> Plug.RequestId.call(Plug.RequestId.init(assign_as: :request_id))
        |> ObservabilityContext.call([])

      assert conn.assigns.observability_context == %{
               request_id: @request_id,
               trace_id: @trace_id,
               viewer_id: nil,
               live_session_id: nil
             }

      assert get_resp_header(conn, "x-trace-id") == [@trace_id]
    end
  end
end
