defmodule Mix.Tasks.Release.CapacityDrill do
  use Mix.Task
  use Boundary, classify_to: LC

  alias LC.Release.CapacityDrill

  @shortdoc "Prints/executes capacity verification drill steps"
  @moduledoc """
  Runs an operator-facing capacity verification checklist.

  Supported options:

    * `--feed-iterations` number of feed-query iterations for probe sizing (default: 200)
    * `--fanout-viewers` number of channel subscribers for fanout probe sizing (default: 50)
    * `--concurrency-viewers` number of concurrent live joins for probe sizing (default: 30)
    * `--feed-mean-ms` max feed mean latency threshold in milliseconds (default: 120.0)
    * `--feed-p95-ms` max feed p95 latency threshold in milliseconds (default: 180.0)
    * `--channel-min-delivery-rate` minimum channel delivery ratio (default: 1.0)
    * `--channel-p95-ms` max channel fanout p95 latency threshold in milliseconds (default: 200.0)
    * `--live-min-success-rate` minimum live join success ratio (default: 1.0)
    * `--live-p95-ms` max live join p95 latency threshold in milliseconds (default: 300.0)
    * `--confirm` required when environment is not `test`
    * `--dry-run` print ordered drill steps without executing them
  """

  @switches [
    feed_iterations: :integer,
    fanout_viewers: :integer,
    concurrency_viewers: :integer,
    feed_mean_ms: :float,
    feed_p95_ms: :float,
    channel_min_delivery_rate: :float,
    channel_p95_ms: :float,
    live_min_success_rate: :float,
    live_p95_ms: :float,
    confirm: :boolean,
    dry_run: :boolean
  ]

  @impl Mix.Task
  @spec run([String.t()]) :: :ok
  def run(args) do
    # Capacity probes hit Repo/PubSub directly, so this task must bootstrap the
    # application when invoked outside `mix test` aliases.
    Mix.Task.run("app.start")

    {opts, positional, invalid} = OptionParser.parse(args, switches: @switches)

    if positional != [] do
      Mix.raise("unexpected positional arguments: #{inspect(positional)}")
    end

    if invalid != [] do
      Mix.raise("invalid options: #{inspect(invalid)}")
    end

    feed_iterations = Keyword.get(opts, :feed_iterations, 200)
    fanout_viewers = Keyword.get(opts, :fanout_viewers, 50)
    concurrency_viewers = Keyword.get(opts, :concurrency_viewers, 30)
    feed_mean_ms = Keyword.get(opts, :feed_mean_ms, 120.0)
    feed_p95_ms = Keyword.get(opts, :feed_p95_ms, 180.0)
    channel_min_delivery_rate = Keyword.get(opts, :channel_min_delivery_rate, 1.0)
    channel_p95_ms = Keyword.get(opts, :channel_p95_ms, 200.0)
    live_min_success_rate = Keyword.get(opts, :live_min_success_rate, 1.0)
    live_p95_ms = Keyword.get(opts, :live_p95_ms, 300.0)
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)

    case CapacityDrill.run(
           feed_iterations: feed_iterations,
           fanout_viewers: fanout_viewers,
           concurrency_viewers: concurrency_viewers,
           feed_mean_latency_ms: feed_mean_ms,
           feed_p95_latency_ms: feed_p95_ms,
           channel_min_delivery_rate: channel_min_delivery_rate,
           channel_p95_latency_ms: channel_p95_ms,
           live_min_success_rate: live_min_success_rate,
           live_p95_latency_ms: live_p95_ms,
           confirm: confirm?,
           dry_run: dry_run?
         ) do
      {:ok, report} ->
        print_report(report)
        :ok

      {:dry_run, steps} ->
        Mix.shell().info("Release capacity drill dry run (execution order):")
        Enum.each(steps, &Mix.shell().info("- #{CapacityDrill.format_step(&1)}"))
        :ok

      {:error, :invalid_feed_iterations} ->
        Mix.raise("--feed-iterations must be a positive integer")

      {:error, :invalid_fanout_viewers} ->
        Mix.raise("--fanout-viewers must be a positive integer")

      {:error, :invalid_concurrency_viewers} ->
        Mix.raise("--concurrency-viewers must be a positive integer")

      {:error, :invalid_feed_mean_latency_ms} ->
        Mix.raise("--feed-mean-ms must be a positive number")

      {:error, :invalid_feed_p95_latency_ms} ->
        Mix.raise("--feed-p95-ms must be a positive number")

      {:error, :invalid_channel_min_delivery_rate} ->
        Mix.raise("--channel-min-delivery-rate must be a number between 0 and 1")

      {:error, :invalid_channel_p95_latency_ms} ->
        Mix.raise("--channel-p95-ms must be a positive number")

      {:error, :invalid_live_min_success_rate} ->
        Mix.raise("--live-min-success-rate must be a number between 0 and 1")

      {:error, :invalid_live_p95_latency_ms} ->
        Mix.raise("--live-p95-ms must be a positive number")

      {:error, :invalid_probe_timeout_ms} ->
        Mix.raise("probe timeout must be a positive integer")

      {:error, :invalid_probes} ->
        Mix.raise("invalid probe selection; expected one or more of feed/channel/live")

      {:error, :confirmation_required} ->
        Mix.raise(
          "release.capacity_drill requires --confirm when MIX_ENV is not test (current: #{Mix.env()})"
        )

      {:error, %{step: failed_step, reason: reason}} ->
        Mix.raise(
          "release capacity drill failed at #{CapacityDrill.format_step(failed_step)}: #{format_reason(reason)}"
        )
    end
  end

  @spec print_report(CapacityDrill.report()) :: :ok
  defp print_report(report) when is_map(report) do
    Mix.shell().info("Release capacity drill report:")
    Mix.shell().info("Evaluation timestamp (UTC): #{DateTime.to_iso8601(report.evaluated_at)}")
    Mix.shell().info("Feed iterations: #{report.feed_iterations}")
    Mix.shell().info("Fanout viewers: #{report.fanout_viewers}")
    Mix.shell().info("Concurrency viewers: #{report.concurrency_viewers}")

    Enum.each(report.probes, fn probe ->
      Mix.shell().info(
        "- #{probe.probe}: status=#{if probe.passed?, do: "pass", else: "fail"}, sample_size=#{probe.sample_size}, success_rate=#{probe.success_rate}, mean_ms=#{probe.mean_latency_ms}, p95_ms=#{probe.p95_latency_ms}, threshold=#{inspect(probe.threshold)}"
      )

      if probe.failure_reasons != [] do
        Enum.each(probe.failure_reasons, &Mix.shell().info("  failure: #{&1}"))
      end
    end)

    Mix.shell().info("Overall status: #{if report.passed?, do: "pass", else: "fail"}")
    :ok
  end

  @spec format_reason(term()) :: String.t()
  defp format_reason({:threshold_failed, report}) when is_map(report) do
    reasons =
      report
      |> Map.get(:failure_reasons, [])
      |> Enum.join("; ")

    "thresholds exceeded for #{report.probe}: #{reasons}"
  end

  defp format_reason({:probe_failed, probe, reason}) do
    "probe #{probe} failed: #{format_reason(reason)}"
  end

  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
end
