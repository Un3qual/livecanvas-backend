defmodule LC.Integration.Release.CapacityDrillFeedTest do
  use LC.DataCase, async: false

  import Ecto.Query

  alias LC.Release.CapacityDrill
  alias LCSchemas.Content.Post

  describe "feed probe thresholds" do
    test "returns structured feed probe metrics when latency thresholds pass" do
      assert {:ok, report} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:feed],
                 feed_iterations: 8,
                 fanout_viewers: 1,
                 concurrency_viewers: 1,
                 feed_mean_latency_ms: 300.0,
                 feed_p95_latency_ms: 400.0
               )

      assert report.passed?
      assert is_struct(report.evaluated_at, DateTime)
      assert [%{probe: :feed} = feed_probe] = report.probes
      assert feed_probe.passed?
      assert feed_probe.sample_size == 8
      assert feed_probe.success_rate == 1.0
      assert is_float(feed_probe.mean_latency_ms)
      assert is_float(feed_probe.p95_latency_ms)
    end

    test "fails when feed latency thresholds are exceeded" do
      assert {:error,
              %{step: %{name: "Feed query load probe"}, reason: {:threshold_failed, report}}} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:feed],
                 feed_iterations: 6,
                 fanout_viewers: 1,
                 concurrency_viewers: 1,
                 feed_mean_latency_ms: 0.05,
                 feed_p95_latency_ms: 0.05
               )

      assert report.probe == :feed
      refute report.passed?
      assert report.failure_reasons != []
    end

    test "seeds follower-only posts so probe fixtures do not surface in public feeds" do
      assert {:ok, _report} =
               CapacityDrill.run(
                 env: :test,
                 probes: [:feed],
                 feed_iterations: 2,
                 fanout_viewers: 1,
                 concurrency_viewers: 1,
                 feed_mean_latency_ms: 500.0,
                 feed_p95_latency_ms: 500.0
               )

      visibility_values =
        from(post in Post,
          where: like(post.body_text, "capacity probe feed post%"),
          select: post.visibility
        )
        |> Repo.all()

      assert visibility_values != []
      assert Enum.all?(visibility_values, &(&1 == :followers))
    end
  end
end
