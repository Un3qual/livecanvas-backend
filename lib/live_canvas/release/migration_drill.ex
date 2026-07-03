defmodule LC.Release.MigrationDrill do
  @moduledoc """
  Runs migration rehearsal steps in a deterministic, fail-fast order.
  """

  alias LC.Release.MixStep

  @type drill_step :: MixStep.t()
  @type drill_failure :: MixStep.failure()
  @type runner_fun :: (String.t(), [String.t()] -> :ok | {:error, term()})

  @spec command_plan(pos_integer()) :: [drill_step()]
  def command_plan(step \\ 1) when is_integer(step) and step > 0 do
    [
      %{task: "ecto.create", args: ["--quiet"]},
      %{task: "ecto.migrate", args: ["--quiet"]},
      %{task: "ecto.rollback", args: ["--step", Integer.to_string(step), "--quiet"]},
      %{task: "ecto.migrate", args: ["--quiet"]}
    ]
  end

  @spec run(keyword()) ::
          :ok | {:dry_run, [drill_step()]} | {:error, :confirmation_required | drill_failure()}
  def run(opts \\ []) do
    env = Keyword.get(opts, :env, Mix.env())
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)
    step = Keyword.get(opts, :step, 1)
    runner = Keyword.get(opts, :runner, &default_runner/2)

    with :ok <- validate_step(step),
         :ok <- validate_confirmation(env, confirm?) do
      steps = command_plan(step)

      if dry_run? do
        {:dry_run, steps}
      else
        MixStep.run_steps(steps, runner)
      end
    end
  end

  defp validate_step(step) when is_integer(step) and step > 0, do: :ok
  defp validate_step(_step), do: Mix.raise("--step must be a positive integer")

  @spec validate_confirmation(atom(), boolean()) :: :ok | {:error, :confirmation_required}
  defp validate_confirmation(:test, _confirm?), do: :ok
  defp validate_confirmation(_env, true), do: :ok
  defp validate_confirmation(_env, false), do: {:error, :confirmation_required}

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
