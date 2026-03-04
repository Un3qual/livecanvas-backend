defmodule LC.Infra.AsyncJobs.WorkerTest do
  use LC.DataCase

  alias LC.Infra.AsyncJobs
  alias LC.Infra.AsyncJobs.Worker
  alias LCSchemas.Infra.AsyncJob

  defmodule SuccessHandler do
    @moduledoc false

    @behaviour LC.Infra.AsyncJobs.Handler

    alias LCSchemas.Infra.AsyncJob

    @impl LC.Infra.AsyncJobs.Handler
    @spec handle(AsyncJob.t()) :: :ok
    def handle(%AsyncJob{}), do: :ok
  end

  defmodule RetryHandler do
    @moduledoc false

    @behaviour LC.Infra.AsyncJobs.Handler

    alias LCSchemas.Infra.AsyncJob

    @impl LC.Infra.AsyncJobs.Handler
    @spec handle(AsyncJob.t()) :: {:error, atom()}
    def handle(%AsyncJob{}), do: {:error, :processor_timeout}
  end

  describe "poll loop" do
    test "claims due jobs in batches and marks successful work completed" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, first_job} =
               AsyncJobs.enqueue("worker.success", %{media_asset_id: 1}, scheduled_at: past)

      assert {:ok, second_job} =
               AsyncJobs.enqueue("worker.success", %{media_asset_id: 2}, scheduled_at: past)

      worker =
        start_supervised_worker(
          handlers: %{"worker.success" => SuccessHandler},
          claim_limit: 1
        )

      send(worker, :poll)

      assert_eventually(fn ->
        statuses =
          [first_job.id, second_job.id]
          |> Enum.map(&Repo.get!(AsyncJob, &1).status)
          |> Enum.sort()

        statuses == [:completed, :pending]
      end)

      send(worker, :poll)

      assert_eventually(fn ->
        Enum.all?([first_job.id, second_job.id], fn id ->
          Repo.get!(AsyncJob, id).status == :completed
        end)
      end)
    end

    test "schedules retries with backoff when handlers return errors" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, job} =
               AsyncJobs.enqueue("worker.retry", %{media_asset_id: 3},
                 scheduled_at: past,
                 max_attempts: 3
               )

      worker =
        start_supervised_worker(
          handlers: %{"worker.retry" => RetryHandler},
          claim_limit: 1
        )

      send(worker, :poll)

      assert_eventually(fn ->
        retried = Repo.get!(AsyncJob, job.id)

        retried.status == :pending and
          retried.attempts == 1 and
          retried.last_error == "processor_timeout" and
          is_nil(retried.locked_at) and
          DateTime.compare(retried.scheduled_at, DateTime.utc_now()) == :gt
      end)
    end

    test "marks jobs failed when attempts are exhausted" do
      past = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:microsecond)

      assert {:ok, job} =
               AsyncJobs.enqueue("worker.retry", %{media_asset_id: 4},
                 scheduled_at: past,
                 max_attempts: 1
               )

      worker =
        start_supervised_worker(
          handlers: %{"worker.retry" => RetryHandler},
          claim_limit: 1
        )

      send(worker, :poll)

      assert_eventually(fn ->
        failed = Repo.get!(AsyncJob, job.id)

        failed.status == :failed and
          failed.attempts == 1 and
          failed.last_error == "processor_timeout" and
          is_nil(failed.locked_at)
      end)
    end
  end

  @spec start_supervised_worker(keyword()) :: pid()
  defp start_supervised_worker(opts) do
    base_opts = [
      poll_interval_ms: 60_000,
      claim_limit: 5,
      handlers: %{}
    ]

    start_supervised!({Worker, Keyword.merge(base_opts, opts)})
  end

  @spec assert_eventually((-> boolean()), non_neg_integer()) :: :ok
  defp assert_eventually(assertion, attempts \\ 20)

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
