defmodule LC.Integration.MediaWebhookAsyncFlowTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Content
  alias LC.Infra.AsyncJobs.Worker
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  describe "media async processing flows" do
    test "worker processes finalize-enqueued media jobs to processed" do
      owner = user_fixture()

      assert {:ok, %{media_asset: media_asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:ok, finalized_media_asset} =
               Content.finalize_media_upload(owner, media_asset.id, %{width: 320, height: 240})

      assert finalized_media_asset.processing_state == :uploaded

      worker =
        start_supervised!({Worker, worker_opts()})

      send(worker, :poll)

      assert_eventually(fn ->
        processed_media_asset = Content.get_user_media_asset(owner, media_asset.id)
        processed_media_asset.processing_state == :processed
      end)
    end

    test "worker marks media assets failed after retries are exhausted" do
      owner = user_fixture()

      assert {:ok, %{media_asset: media_asset}} =
               Content.request_media_upload(owner, %{mime_type: "application/octet-stream"})

      assert {:ok, finalized_media_asset} =
               Content.finalize_media_upload(owner, media_asset.id, %{})

      assert finalized_media_asset.processing_state == :uploaded

      worker =
        start_supervised!({Worker, worker_opts(claim_limit: 1)})

      send(worker, :poll)

      assert_eventually(fn ->
        retried_job = Repo.one!(AsyncJob)
        retried_job.status == :pending and retried_job.attempts == 1
      end)

      force_job_due_now!()
      send(worker, :poll)

      assert_eventually(fn ->
        failed_job = Repo.one!(AsyncJob)
        failed_media_asset = Content.get_user_media_asset(owner, media_asset.id)

        failed_job.status == :failed and failed_media_asset.processing_state == :failed
      end)
    end

    test "worker applies webhook payload metadata to media assets" do
      owner = user_fixture()

      assert {:ok, media_asset} =
               Content.create_media_asset(owner, %{
                 storage_key: "uploads/users/#{owner.id}/from-webhook.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :uploaded
               })

      assert {:ok, :accepted} =
               Content.ingest_media_processing_webhook("evt_webhook_processed", %{
                 "event_type" => "media.processed",
                 "media_asset_id" => media_asset.id,
                 "processing_state" => "processed",
                 "metadata" => %{"width" => 1234, "height" => 4321, "duration_ms" => 9876}
               })

      worker =
        start_supervised!({Worker, worker_opts(claim_limit: 1)})

      send(worker, :poll)

      assert_eventually(fn ->
        processed_media_asset = Content.get_user_media_asset(owner, media_asset.id)
        async_job = Repo.one!(AsyncJob)
        webhook_event = Repo.one!(WebhookEvent)

        async_job.kind == "media_processing_webhook" and
          async_job.status == :completed and
          processed_media_asset.processing_state == :processed and
          processed_media_asset.width == 1234 and
          processed_media_asset.height == 4321 and
          processed_media_asset.duration_ms == 9876 and
          webhook_event.status == :processed and
          match?(%DateTime{}, webhook_event.processed_at)
      end)
    end
  end

  @spec worker_opts(keyword()) :: keyword()
  defp worker_opts(overrides \\ []) do
    defaults = [
      poll_interval_ms: 60_000,
      claim_limit: 10,
      handlers: %{
        "media_asset_processing" => LC.Content.MediaProcessingJob,
        "media_processing_webhook" => LC.Content.MediaProcessingJob
      }
    ]

    Keyword.merge(defaults, overrides)
  end

  @spec force_job_due_now!() :: :ok
  defp force_job_due_now! do
    now = DateTime.utc_now() |> DateTime.add(-1, :second) |> DateTime.truncate(:microsecond)

    {_updated_count, _rows} =
      Repo.update_all(AsyncJob, set: [scheduled_at: now, locked_at: nil, status: :pending])

    :ok
  end

  @spec assert_eventually((-> boolean()), non_neg_integer()) :: :ok
  defp assert_eventually(assertion, attempts \\ 25)

  defp assert_eventually(_assertion, 0), do: flunk("condition was not met before timeout")

  defp assert_eventually(assertion, attempts) do
    if assertion.() do
      :ok
    else
      Process.sleep(20)
      assert_eventually(assertion, attempts - 1)
    end
  end
end
