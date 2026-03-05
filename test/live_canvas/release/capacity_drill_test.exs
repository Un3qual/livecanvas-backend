defmodule LC.Release.CapacityDrillTest do
  use ExUnit.Case, async: false

  alias LC.Release.CapacityDrill

  @thresholds %{
    feed_mean_latency_ms: 120.0,
    feed_p95_latency_ms: 180.0,
    channel_min_delivery_rate: 1.0,
    channel_p95_latency_ms: 200.0,
    live_min_success_rate: 1.0,
    live_p95_latency_ms: 300.0
  }

  describe "run/1" do
    test "returns deterministic drill steps for dry runs" do
      assert {:dry_run, steps} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 feed_iterations: 120,
                 fanout_viewers: 45,
                 concurrency_viewers: 30
               )

      assert Enum.map(steps, & &1.name) == [
               "Feed query load probe",
               "Channel fanout probe",
               "Live-session concurrency probe"
             ]

      assert Enum.at(steps, 0).command =~ "feed_iterations=120"
      assert Enum.at(steps, 1).command =~ "fanout_viewers=45"
      assert Enum.at(steps, 2).command =~ "concurrency_viewers=30"
    end

    test "requires explicit confirmation outside test env" do
      assert {:error, :confirmation_required} =
               CapacityDrill.run(
                 env: :prod,
                 feed_iterations: 120,
                 fanout_viewers: 45,
                 concurrency_viewers: 30
               )
    end

    test "rejects invalid probe sizing options" do
      assert {:error, :invalid_feed_iterations} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 feed_iterations: 0
               )

      assert {:error, :invalid_fanout_viewers} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 fanout_viewers: -1
               )

      assert {:error, :invalid_concurrency_viewers} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 concurrency_viewers: 0
               )
    end

    test "rejects invalid threshold and probe-selection options" do
      assert {:error, :invalid_feed_mean_latency_ms} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 feed_mean_latency_ms: 0
               )

      assert {:error, :invalid_channel_min_delivery_rate} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 channel_min_delivery_rate: 1.1
               )

      assert {:error, :invalid_probes} =
               CapacityDrill.run(
                 env: :test,
                 dry_run: true,
                 probes: [:unknown]
               )
    end
  end

  describe "build_probe_report/3" do
    test "fails strict delivery thresholds when a single delivery is missing at large sample sizes" do
      report =
        CapacityDrill.build_probe_report(
          :channel,
          %{sample_size: 2001, success_count: 2000, latency_ms: [1.0]},
          @thresholds
        )

      refute report.passed?
      assert report.delivery_rate < 1.0
      assert Enum.any?(report.failure_reasons, &String.contains?(&1, "delivery rate"))
    end
  end
end
