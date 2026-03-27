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

    test "replaces unsafe canonical request ids on the conn and response header" do
      invalid_request_id = "invalid+request+id+123"

      conn =
        :get
        |> conn("/")
        |> put_req_header("x-request-id", invalid_request_id)
        |> Plug.RequestId.call(Plug.RequestId.init(assign_as: :request_id))
        |> ObservabilityContext.call([])

      sanitized_request_id = conn.assigns.request_id

      assert sanitized_request_id =~ ~r/\A[A-Za-z0-9_-]{20,200}\z/
      refute sanitized_request_id == invalid_request_id
      assert conn.assigns.observability_context.request_id == sanitized_request_id
      assert get_resp_header(conn, "x-request-id") == [sanitized_request_id]
    end
  end

  describe "build_socket_context/2" do
    test "replaces unsafe client-provided request ids before they reach logger metadata" do
      malicious_request_id = "socket-request-id-123\nmalicious"

      context =
        ObservabilityContext.build_socket_context(
          %{"request_id" => malicious_request_id, "trace_id" => @trace_id},
          42
        )

      assert context.trace_id == @trace_id
      assert context.viewer_id == 42
      assert context.live_session_id == nil
      assert context.request_id =~ ~r/\A[A-Za-z0-9_-]{20,200}\z/
      refute context.request_id == malicious_request_id
      refute context.request_id =~ "\n"
    end
  end
end
