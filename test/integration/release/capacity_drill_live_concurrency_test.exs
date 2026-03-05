defmodule LC.Integration.Release.CapacityDrillLiveConcurrencyTest do
  use LC.DataCase, async: false

  alias LC.Release.CapacityDrill

  describe "live concurrency probe thresholds" do
    test "returns structured live probe metrics when concurrency thresholds pass" do
      assert {:ok, report} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:live],
                 feed_iterations: 1,
                 fanout_viewers: 1,
                 concurrency_viewers: 8,
                 live_min_success_rate: 1.0,
                 live_p95_latency_ms: 500.0
               )

      assert report.passed?
      assert [%{probe: :live} = live_probe] = report.probes
      assert live_probe.sample_size == 8
      assert live_probe.success_rate >= 1.0
      assert live_probe.passed?
      assert is_float(live_probe.p95_latency_ms)
    end

    test "fails when live join latency threshold is exceeded" do
      assert {:error,
              %{
                step: %{name: "Live-session concurrency probe"},
                reason: {:threshold_failed, report}
              }} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:live],
                 feed_iterations: 1,
                 fanout_viewers: 1,
                 concurrency_viewers: 6,
                 live_min_success_rate: 1.0,
                 live_p95_latency_ms: 0.05
               )

      assert report.probe == :live
      refute report.passed?
      assert report.failure_reasons != []
    end
  end
end
