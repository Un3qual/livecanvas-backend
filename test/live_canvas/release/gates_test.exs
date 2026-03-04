defmodule LC.Release.GatesTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  alias LC.Release.Gates

  describe "run/1" do
    test "runs the default gate steps in deterministic order" do
      caller = self()

      runner = fn task, args ->
        send(caller, {:gate_step, task, args})
        :ok
      end

      assert :ok = Gates.run(runner: runner)

      assert_receive {:gate_step, "compile", ["--warnings-as-errors"]}
      assert_receive {:gate_step, "test", []}
      assert_receive {:gate_step, "typecheck", []}
      assert_receive {:gate_step, "boundary.spec", []}
      refute_receive {:gate_step, _, _}
    end

    test "stops after the first failing gate step" do
      caller = self()

      runner = fn task, args ->
        send(caller, {:gate_step, task, args})

        case task do
          "test" -> {:error, :test_failed}
          _ -> :ok
        end
      end

      assert {:error, %{step: %{task: "test", args: []}, reason: :test_failed}} =
               Gates.run(runner: runner)

      assert_receive {:gate_step, "compile", ["--warnings-as-errors"]}
      assert_receive {:gate_step, "test", []}
      refute_receive {:gate_step, "typecheck", []}
      refute_receive {:gate_step, "boundary.spec", []}
    end
  end

  describe "mix release.gates --dry-run" do
    test "prints ordered gate commands without executing them" do
      output =
        capture_io(fn ->
          Mix.Task.reenable("release.gates")
          Mix.Task.run("release.gates", ["--dry-run"])
        end)

      assert output =~ "mix compile --warnings-as-errors"
      assert output =~ "mix test"
      assert output =~ "mix typecheck"
      assert output =~ "mix boundary.spec"
    end
  end
end
