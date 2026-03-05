defmodule LC.Integration.Release.CapacityDrillChannelTest do
  use LC.DataCase, async: false

  alias LC.Release.CapacityDrill

  describe "channel fanout probe thresholds" do
    test "returns structured channel probe metrics when delivery and latency thresholds pass" do
      assert {:ok, report} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:channel],
                 feed_iterations: 1,
                 fanout_viewers: 12,
                 concurrency_viewers: 1,
                 channel_min_delivery_rate: 1.0,
                 channel_p95_latency_ms: 400.0
               )

      assert report.passed?
      assert [%{probe: :channel} = channel_probe] = report.probes
      assert channel_probe.sample_size == 12
      assert channel_probe.delivery_rate >= 1.0
      assert channel_probe.passed?
      assert is_float(channel_probe.p95_latency_ms)
    end

    test "fails when channel fanout latency threshold is exceeded" do
      assert {:error,
              %{step: %{name: "Channel fanout probe"}, reason: {:threshold_failed, report}}} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:channel],
                 feed_iterations: 1,
                 fanout_viewers: 10,
                 concurrency_viewers: 1,
                 channel_min_delivery_rate: 1.0,
                 channel_p95_latency_ms: 0.01
               )

      assert report.probe == :channel
      refute report.passed?
      assert report.failure_reasons != []
    end

    test "starts timeout windows after any pre-broadcast delay" do
      started_at = System.monotonic_time(:millisecond)

      assert {:ok, report} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:channel],
                 feed_iterations: 1,
                 fanout_viewers: 16,
                 concurrency_viewers: 1,
                 probe_timeout_ms: 50,
                 channel_pre_broadcast_delay_ms: 120,
                 channel_min_delivery_rate: 1.0,
                 channel_p95_latency_ms: 500.0
               )

      finished_at = System.monotonic_time(:millisecond)
      assert finished_at - started_at >= 120

      assert report.passed?
      assert [%{probe: :channel} = channel_probe] = report.probes
      assert channel_probe.delivery_rate == 1.0
    end
  end
end
