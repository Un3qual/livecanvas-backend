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
      assert_receive {:gate_step, "release.capacity_drill", ["--confirm"]}
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
      refute_receive {:gate_step, "release.capacity_drill", ["--confirm"]}
    end

    test "runs capacity drill in an isolated mix command runner" do
      caller = self()

      mix_command_runner = fn command, args, opts ->
        send(caller, {:mix_command, command, args, opts})
        {"", 0}
      end

      assert :ok =
               Gates.run(
                 steps: [%{task: "release.capacity_drill", args: ["--dry-run", "--confirm"]}],
                 mix_command_runner: mix_command_runner
               )

      assert_receive {:mix_command, command, ["release.capacity_drill", "--dry-run", "--confirm"],
                      opts}

      assert is_binary(command)
      assert {"MIX_ENV", Atom.to_string(Mix.env())} in Keyword.get(opts, :env, [])
      assert Keyword.get(opts, :stderr_to_stdout) == true
    end

    test "returns a gate failure when isolated capacity command exits non-zero" do
      mix_command_runner = fn _command, _args, _opts -> {"capacity failed", 1} end

      assert {:error,
              %{
                step: %{task: "release.capacity_drill", args: ["--dry-run", "--confirm"]},
                reason: reason
              }} =
               Gates.run(
                 steps: [%{task: "release.capacity_drill", args: ["--dry-run", "--confirm"]}],
                 mix_command_runner: mix_command_runner
               )

      assert reason =~ "capacity failed"
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
      assert output =~ "mix release.capacity_drill --confirm"
    end
  end
end
