defmodule LC.Release.LiveRuntimeDrillTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  alias LC.Release.LiveRuntimeDrill

  describe "run/1" do
    test "returns deterministic drill steps for dry runs" do
      assert {:dry_run, steps} =
               LiveRuntimeDrill.run(
                 env: :test,
                 dry_run: true,
                 session_id: 42,
                 takeover_node: "takeover@node"
               )

      assert Enum.map(steps, & &1.name) == [
               "Capture current runtime owner lease",
               "Simulate owner-node partition",
               "Force ownership takeover on target node",
               "Run reconnect join probe",
               "Restore topology and verify steady owner"
             ]

      assert Enum.at(steps, 0).command ==
               "Inspect lease owner for live_session_id=42 and record lease_expires_at/heartbeat_at."

      assert Enum.at(steps, 2).command ==
               "On takeover node takeover@node, start/restart session runtime for live_session_id=42 and confirm lease owner flips."
    end

    test "requires explicit confirmation outside test env" do
      assert {:error, :confirmation_required} =
               LiveRuntimeDrill.run(env: :prod, session_id: 42, takeover_node: "takeover@node")
    end
  end

  describe "mix release.live_runtime_drill --dry-run" do
    test "prints ordered operator drill steps without executing them" do
      output =
        capture_io(fn ->
          Mix.Task.reenable("release.live_runtime_drill")

          Mix.Task.run("release.live_runtime_drill", [
            "--session-id",
            "42",
            "--takeover-node",
            "takeover@node",
            "--dry-run"
          ])
        end)

      assert output =~ "Release live runtime drill dry run (execution order):"
      assert output =~ "Capture current runtime owner lease"
      assert output =~ "live_session_id=42"
      assert output =~ "takeover@node"
      assert output =~ "Run reconnect join probe"
    end

    test "fails fast when --session-id is missing" do
      assert_raise Mix.Error, ~r/--session-id is required/, fn ->
        capture_io(fn ->
          Mix.Task.reenable("release.live_runtime_drill")
          Mix.Task.run("release.live_runtime_drill", ["--dry-run"])
        end)
      end
    end
  end
end
