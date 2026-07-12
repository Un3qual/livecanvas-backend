defmodule LC.Integration.MediaWebhookAsyncFlowTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import LC.ContentFixtures, only: [media_asset_fixture: 2]

  alias LC.Content
  alias LC.Infra.AsyncJobs.Worker
  alias LC.Infra.ObjectStorage.FakeAdapter
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  describe "media async processing flows" do
    test "worker processes finalize-enqueued media jobs to processed" do
      owner = user_fixture()

      assert {:ok, %{media_asset: media_asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      put_fake_upload!(media_asset)

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

      assert {:ok, post} =
               Content.create_post(owner, %{
                 kind: :standard,
                 body_text: "processed upload",
                 media_asset_ids: [media_asset.id]
               })

      assert [attached_media_asset] = Repo.preload(post, :media_assets).media_assets
      assert attached_media_asset.id == media_asset.id
    end

    test "worker marks media assets failed after retries are exhausted" do
      owner = user_fixture()

      media_asset =
        media_asset_fixture(owner, %{
          mime_type: "application/octet-stream",
          processing_state: :uploaded
        })

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

      media_asset =
        media_asset_fixture(owner, %{
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

    test "signed webhook jobs cannot process or fail unfinalized assets" do
      owner = user_fixture()
      worker = start_supervised!({Worker, worker_opts(claim_limit: 1)})

      for processing_state <- ["processed", "failed"] do
        assert {:ok, %{media_asset: media_asset}} =
                 Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

        assert {:ok, :accepted} =
                 Content.ingest_media_processing_webhook(
                   "evt_pending_#{processing_state}",
                   %{
                     "event_type" => "media.#{processing_state}",
                     "media_asset_id" => media_asset.id,
                     "processing_state" => processing_state,
                     "metadata" => %{"width" => 1234}
                   }
                 )

        send(worker, :poll)

        assert_eventually(fn ->
          persisted_media_asset = Content.get_user_media_asset(owner, media_asset.id)

          webhook_event =
            Repo.get_by!(WebhookEvent, external_event_id: "evt_pending_#{processing_state}")

          persisted_media_asset.processing_state == :pending_upload and
            persisted_media_asset.width == nil and webhook_event.status == :failed
        end)
      end
    end
  end

  defp put_fake_upload!(media_asset) do
    assert :ok =
             FakeAdapter.put_object(%{
               key: media_asset.storage_key,
               mime_type: media_asset.mime_type,
               content_length: 1024
             })
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
