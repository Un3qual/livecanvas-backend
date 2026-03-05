defmodule Mix.Tasks.Release.CapacityDrillTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  @mix_executable System.find_executable("mix")

  describe "mix release.capacity_drill --dry-run" do
    test "prints ordered operator drill steps without executing probes" do
      output =
        capture_io(fn ->
          Mix.Task.reenable("release.capacity_drill")

          Mix.Task.run("release.capacity_drill", [
            "--dry-run",
            "--feed-iterations",
            "120",
            "--fanout-viewers",
            "45",
            "--concurrency-viewers",
            "30"
          ])
        end)

      assert output =~ "Release capacity drill dry run (execution order):"
      assert output =~ "Feed query load probe"
      assert output =~ "feed_iterations=120"
      assert output =~ "Channel fanout probe"
      assert output =~ "fanout_viewers=45"
      assert output =~ "Live-session concurrency probe"
      assert output =~ "concurrency_viewers=30"
    end

    test "fails fast when feed iterations are invalid" do
      assert_raise Mix.Error, ~r/--feed-iterations must be a positive integer/, fn ->
        capture_io(fn ->
          Mix.Task.reenable("release.capacity_drill")
          Mix.Task.run("release.capacity_drill", ["--dry-run", "--feed-iterations", "0"])
        end)
      end
    end

    test "fails fast when positional args are provided" do
      assert_raise Mix.Error, ~r/unexpected positional arguments/, fn ->
        capture_io(fn ->
          Mix.Task.reenable("release.capacity_drill")
          Mix.Task.run("release.capacity_drill", ["--dry-run", "extra"])
        end)
      end
    end

    test "fails fast when threshold options are invalid" do
      assert_raise Mix.Error,
                   ~r/--channel-min-delivery-rate must be a number between 0 and 1/,
                   fn ->
                     capture_io(fn ->
                       Mix.Task.reenable("release.capacity_drill")

                       Mix.Task.run("release.capacity_drill", [
                         "--dry-run",
                         "--channel-min-delivery-rate",
                         "1.5"
                       ])
                     end)
                   end
    end

    test "does not require app startup in an isolated process" do
      assert is_binary(@mix_executable)

      {output, status} =
        System.cmd(
          @mix_executable,
          ["release.capacity_drill", "--dry-run", "--confirm"],
          env: [{"MIX_ENV", "prod"}],
          stderr_to_stdout: true
        )

      assert status == 0
      assert output =~ "Release capacity drill dry run (execution order):"
    end

    test "invalid options fail fast in an isolated process before app startup" do
      assert is_binary(@mix_executable)

      {output, status} =
        System.cmd(
          @mix_executable,
          ["release.capacity_drill", "--feed-iterations", "0", "--confirm"],
          env: [{"MIX_ENV", "prod"}],
          stderr_to_stdout: true
        )

      assert status != 0
      assert output =~ "--feed-iterations must be a positive integer"
    end
  end
end
