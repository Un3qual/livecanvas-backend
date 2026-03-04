defmodule LC.Release.MigrationDrillTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  alias LC.Release.MigrationDrill

  describe "run/1" do
    test "runs the default rehearsal pipeline in deterministic order" do
      caller = self()

      runner = fn task, args ->
        send(caller, {:drill_step, task, args})
        :ok
      end

      assert :ok = MigrationDrill.run(env: :test, runner: runner)

      assert_receive {:drill_step, "ecto.create", ["--quiet"]}
      assert_receive {:drill_step, "ecto.migrate", ["--quiet"]}
      assert_receive {:drill_step, "ecto.rollback", ["--step", "1", "--quiet"]}
      assert_receive {:drill_step, "ecto.migrate", ["--quiet"]}
      refute_receive {:drill_step, _, _}
    end

    test "uses --step override for rollback depth" do
      caller = self()

      runner = fn task, args ->
        send(caller, {:drill_step, task, args})
        :ok
      end

      assert :ok = MigrationDrill.run(env: :test, step: 3, runner: runner)

      assert_receive {:drill_step, "ecto.create", ["--quiet"]}
      assert_receive {:drill_step, "ecto.migrate", ["--quiet"]}
      assert_receive {:drill_step, "ecto.rollback", ["--step", "3", "--quiet"]}
      assert_receive {:drill_step, "ecto.migrate", ["--quiet"]}
      refute_receive {:drill_step, _, _}
    end

    test "requires explicit confirmation outside test env" do
      assert {:error, :confirmation_required} = MigrationDrill.run(env: :prod)
    end
  end

  describe "mix release.migration_drill --dry-run" do
    test "prints rehearsal command plan without executing commands" do
      output =
        capture_io(fn ->
          Mix.Task.reenable("release.migration_drill")
          Mix.Task.run("release.migration_drill", ["--dry-run", "--step", "2"])
        end)

      assert output =~ "mix ecto.create --quiet"
      assert output =~ "mix ecto.migrate --quiet"
      assert output =~ "mix ecto.rollback --step 2 --quiet"
    end
  end
end
