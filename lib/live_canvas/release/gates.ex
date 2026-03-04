defmodule LC.Release.Gates do
  @moduledoc """
  Runs deterministic release preflight gates in a fail-fast order.
  """

  @type gate_step :: %{task: String.t(), args: [String.t()]}
  @type gate_failure :: %{step: gate_step(), reason: term()}
  @type runner_fun :: (String.t(), [String.t()] -> :ok | {:error, term()})

  @spec default_steps() :: [gate_step()]
  def default_steps do
    [
      %{task: "compile", args: ["--warnings-as-errors"]},
      %{task: "test", args: []},
      %{task: "typecheck", args: []},
      %{task: "boundary.spec", args: []}
    ]
  end

  @spec run(keyword()) :: :ok | {:dry_run, [gate_step()]} | {:error, gate_failure()}
  def run(opts \\ []) do
    steps = Keyword.get(opts, :steps, default_steps())
    runner = Keyword.get(opts, :runner, &default_runner/2)

    if Keyword.get(opts, :dry_run, false) do
      {:dry_run, steps}
    else
      run_steps(steps, runner)
    end
  end

  @spec format_step(gate_step()) :: String.t()
  def format_step(%{task: task, args: []}), do: "mix #{task}"
  def format_step(%{task: task, args: args}), do: "mix #{task} #{Enum.join(args, " ")}"

  @spec run_steps([gate_step()], runner_fun()) :: :ok | {:error, gate_failure()}
  defp run_steps([], _runner), do: :ok

  defp run_steps([step | remaining], runner) do
    # Fail fast so later gates do not run after the first broken prerequisite.
    case runner.(step.task, step.args) do
      :ok -> run_steps(remaining, runner)
      {:error, reason} -> {:error, %{step: step, reason: reason}}
    end
  end

  @spec default_runner(String.t(), [String.t()]) :: :ok | {:error, term()}
  defp default_runner(task, args) do
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
end
