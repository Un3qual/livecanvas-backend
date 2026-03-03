defmodule LC.Infra.AsyncJobsTest do
  use LC.DataCase, async: true

  alias LC.Infra.{AsyncJobs, WebhookEvent}
  alias LCSchemas.Infra.AsyncJob
  alias LCSchemas.Infra.WebhookEvent, as: WebhookEventSchema

  describe "enqueue/3" do
    test "inserts a pending job with entropy id and default scheduling" do
      assert {:ok, job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 123}, max_attempts: 4)

      assert %AsyncJob{} = job
      assert is_integer(job.id)
      assert is_binary(job.entropy_id)
      assert job.kind == "media_processing"
      assert job.status == :pending
      assert job.attempts == 0
      assert job.max_attempts == 4
      assert %DateTime{} = job.scheduled_at
      assert job.payload == %{media_asset_id: 123}
    end

    test "returns existing row when dedupe key already exists" do
      assert {:ok, first_job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 77},
                 dedupe_key: "event:77"
               )

      assert {:ok, second_job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 88},
                 dedupe_key: "event:77"
               )

      assert second_job.id == first_job.id
      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end
  end

  describe "claim_due_jobs/2" do
    test "claims only due jobs for the requested kind" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      future =
        DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, due_job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 1}, scheduled_at: past)

      assert {:ok, _future_job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 2}, scheduled_at: future)

      assert {:ok, _other_kind_job} =
               AsyncJobs.enqueue("profile_sync", %{user_id: 55}, scheduled_at: past)

      claimed_jobs = AsyncJobs.claim_due_jobs("media_processing", 10)

      assert Enum.map(claimed_jobs, & &1.id) == [due_job.id]

      [claimed] = claimed_jobs
      assert claimed.status == :processing
      assert claimed.attempts == 1
      assert %DateTime{} = claimed.locked_at
    end
  end

  describe "mark_completed/1" do
    test "transitions a claimed job to completed" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 33}, scheduled_at: past)

      [claimed] = AsyncJobs.claim_due_jobs("media_processing", 1)
      assert claimed.id == job.id

      assert {:ok, completed} = AsyncJobs.mark_completed(job.id)

      assert completed.status == :completed
      assert %DateTime{} = completed.completed_at
      assert is_nil(completed.locked_at)
    end
  end

  describe "mark_retry/3" do
    test "reschedules claimed jobs while attempts remain" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 44},
                 scheduled_at: past,
                 max_attempts: 3
               )

      [claimed] = AsyncJobs.claim_due_jobs("media_processing", 1)
      assert claimed.id == job.id

      assert {:ok, retried} = AsyncJobs.mark_retry(job.id, "processor_timeout", 120)

      assert retried.status == :pending
      assert retried.attempts == 1
      assert retried.last_error == "processor_timeout"
      assert DateTime.compare(retried.scheduled_at, DateTime.utc_now()) == :gt
      assert is_nil(retried.locked_at)
      assert is_nil(retried.completed_at)
    end

    test "marks job failed when attempts are exhausted" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, job} =
               AsyncJobs.enqueue("media_processing", %{media_asset_id: 99},
                 scheduled_at: past,
                 max_attempts: 1
               )

      [claimed] = AsyncJobs.claim_due_jobs("media_processing", 1)
      assert claimed.id == job.id

      assert {:ok, failed} = AsyncJobs.mark_retry(job.id, "terminal_failure", 120)

      assert failed.status == :failed
      assert failed.attempts == 1
      assert failed.last_error == "terminal_failure"
      assert is_nil(failed.locked_at)
      assert is_nil(failed.completed_at)
    end
  end

  describe "record_event/3" do
    test "records webhook events idempotently by provider + external event id" do
      attrs = %{event_type: "media.processed", payload: %{result: "ok"}}

      assert {:ok, first, :inserted} =
               WebhookEvent.record_event("media_provider", "evt_123", attrs)

      assert {:ok, second, :duplicate} =
               WebhookEvent.record_event("media_provider", "evt_123", attrs)

      assert second.id == first.id
      assert Repo.aggregate(WebhookEventSchema, :count, :id) == 1
    end
  end
end
