defmodule LCWeb.WebhookControllerTest do
  use LCWeb.ConnCase, async: true

  alias LC.Infra.Repo
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  @secret "test-webhook-secret"

  describe "POST /api/webhooks/media-processing" do
    test "accepts signed requests and enqueues async work", %{conn: conn} do
      payload = valid_payload()

      conn = post_webhook(conn, payload, event_id: "evt_accepted")

      assert %{"status" => "accepted"} = json_response(conn, 202)
      assert Repo.aggregate(WebhookEvent, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1

      webhook_event = Repo.one!(WebhookEvent)
      async_job = Repo.one!(AsyncJob)

      assert webhook_event.provider == "media_processing"
      assert webhook_event.external_event_id == "evt_accepted"
      assert async_job.kind == "media_processing_webhook"
      assert async_job.status == :pending
      assert async_job.dedupe_key == "webhook_event:media_processing:evt_accepted"
    end

    test "returns duplicate ack for repeated event ids", %{conn: conn} do
      payload = valid_payload()

      first_conn = post_webhook(conn, payload, event_id: "evt_duplicate")
      assert %{"status" => "accepted"} = json_response(first_conn, 202)

      second_conn = post_webhook(conn, payload, event_id: "evt_duplicate")
      assert %{"status" => "duplicate"} = json_response(second_conn, 200)

      assert Repo.aggregate(WebhookEvent, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end

    test "rejects invalid signatures", %{conn: conn} do
      payload = valid_payload()

      conn = post_webhook(conn, payload, event_id: "evt_bad_sig", signature: "not-valid")

      assert conn.status == 401
      assert conn.resp_body == "invalid_signature"
      assert Repo.aggregate(WebhookEvent, :count, :id) == 0
      assert Repo.aggregate(AsyncJob, :count, :id) == 0
    end

    test "rejects stale timestamps", %{conn: conn} do
      payload = valid_payload()
      stale_timestamp = System.system_time(:second) - 10_000

      conn = post_webhook(conn, payload, event_id: "evt_stale", timestamp: stale_timestamp)

      assert conn.status == 401
      assert conn.resp_body == "invalid_signature"
      assert Repo.aggregate(WebhookEvent, :count, :id) == 0
      assert Repo.aggregate(AsyncJob, :count, :id) == 0
    end

    test "returns 422 for invalid payload shape", %{conn: conn} do
      payload = %{"event_type" => "media.processed"}

      conn = post_webhook(conn, payload, event_id: "evt_bad_payload")

      assert %{"error" => "invalid_payload"} = json_response(conn, 422)
      assert Repo.aggregate(WebhookEvent, :count, :id) == 0
      assert Repo.aggregate(AsyncJob, :count, :id) == 0
    end
  end

  defp valid_payload do
    %{
      "event_type" => "media.processed",
      "media_asset_id" => 123,
      "processing_state" => "processed",
      "metadata" => %{"duration_ms" => 5678}
    }
  end

  defp post_webhook(conn, payload, opts) do
    body = Jason.encode!(payload)
    timestamp = Keyword.get(opts, :timestamp, System.system_time(:second))
    event_id = Keyword.get(opts, :event_id, "evt_#{System.unique_integer([:positive])}")

    signature =
      Keyword.get_lazy(opts, :signature, fn ->
        webhook_signature(@secret, timestamp, body)
      end)

    conn
    |> put_req_header("content-type", "application/json")
    |> put_req_header("x-livecanvas-signature", signature)
    |> put_req_header("x-livecanvas-timestamp", Integer.to_string(timestamp))
    |> put_req_header("x-livecanvas-event-id", event_id)
    |> post(~p"/api/webhooks/media-processing", body)
  end

  defp webhook_signature(secret, timestamp, raw_body) do
    :crypto.mac(:hmac, :sha256, secret, "#{timestamp}.#{raw_body}")
    |> Base.encode16(case: :lower)
  end
end
