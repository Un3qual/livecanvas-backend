defmodule LC.Release.Gates do
  @moduledoc """
  Runs deterministic release preflight gates in a fail-fast order.
  """

  @type gate_step :: LC.Release.MixStep.t()
  @type gate_failure :: %{step: gate_step(), reason: term()}
  @type runner_fun :: (String.t(), [String.t()] -> :ok | {:error, term()})
  @type mix_command_runner :: (String.t(), [String.t()], keyword() -> {String.t(), integer()})

  @spec default_steps() :: [gate_step()]
  def default_steps do
    [
      %{task: "compile", args: ["--warnings-as-errors"]},
      %{task: "test", args: []},
      %{task: "typecheck", args: []},
      %{task: "boundary.spec", args: []},
      # Capacity drill requires explicit confirmation outside test environments.
      %{task: "release.capacity_drill", args: ["--confirm"]}
    ]
  end

  @spec run(keyword()) :: :ok | {:dry_run, [gate_step()]} | {:error, gate_failure()}
  def run(opts \\ []) do
    steps = Keyword.get(opts, :steps, default_steps())

    mix_command_runner =
      Keyword.get(opts, :mix_command_runner, fn command, args, command_opts ->
        System.cmd(command, args, command_opts)
      end)

    runner =
      Keyword.get(opts, :runner, fn task, args ->
        default_runner(task, args, mix_command_runner)
      end)

    if Keyword.get(opts, :dry_run, false) do
      {:dry_run, steps}
    else
      run_steps(steps, runner)
    end
  end

  @spec run_steps([gate_step()], runner_fun()) :: :ok | {:error, gate_failure()}
  defp run_steps([], _runner), do: :ok

  defp run_steps([step | remaining], runner) do
    # Fail fast so later gates do not run after the first broken prerequisite.
    case runner.(step.task, step.args) do
      :ok -> run_steps(remaining, runner)
      {:error, reason} -> {:error, %{step: step, reason: reason}}
    end
  end

  @spec default_runner(String.t(), [String.t()], mix_command_runner()) :: :ok | {:error, term()}
  defp default_runner("release.capacity_drill", args, mix_command_runner) do
    # The `mix test` gate step sets SQL sandbox mode to manual in this VM.
    # Run capacity drill in a fresh Mix process to avoid leaked sandbox state.
    run_mix_command("release.capacity_drill", args, mix_command_runner)
  rescue
    error in [Mix.Error, Mix.NoTaskError] ->
      {:error, Exception.message(error)}
  catch
    kind, reason ->
      {:error, {kind, reason}}
  end

  defp default_runner(task, args, _mix_command_runner) do
    Mix.Task.reenable(task)
    Mix.Task.run(task, args)
    :ok
  rescue
    error in [Mix.Error, Mix.NoTaskError] ->
      {:error, Exception.message(error)}
  catch
    kind, reason ->
      {:error, {kind, reason}}
  end

  @spec run_mix_command(String.t(), [String.t()], mix_command_runner()) :: :ok | {:error, term()}
  defp run_mix_command(task, args, mix_command_runner)
       when is_binary(task) and is_list(args) do
    case System.find_executable("mix") do
      nil ->
        {:error, "mix executable not found"}

      mix_executable ->
        {output, exit_code} =
          mix_command_runner.(mix_executable, [task | args],
            env: [{"MIX_ENV", Atom.to_string(Mix.env())}],
            stderr_to_stdout: true
          )

        if exit_code == 0 do
          :ok
        else
          {:error, String.trim(output)}
        end
    end
  end
end
