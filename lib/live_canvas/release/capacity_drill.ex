defmodule LC.Release.CapacityDrill do
  @moduledoc """
  Builds and executes deterministic operator steps for capacity verification drills.
  """

  @default_feed_iterations 200
  @default_fanout_viewers 50
  @default_concurrency_viewers 30

  @type drill_step :: %{
          name: String.t(),
          command: String.t(),
          success_criteria: String.t()
        }
  @type drill_failure :: %{step: drill_step(), reason: term()}
  @type runner_fun :: (drill_step() -> :ok | {:error, term()})

  @spec command_plan(pos_integer(), pos_integer(), pos_integer()) :: [drill_step()]
  def command_plan(feed_iterations, fanout_viewers, concurrency_viewers)
      when is_integer(feed_iterations) and feed_iterations > 0 and is_integer(fanout_viewers) and
             fanout_viewers > 0 and is_integer(concurrency_viewers) and concurrency_viewers > 0 do
    [
      %{
        name: "Feed query load probe",
        command:
          "Run feed query probe with feed_iterations=#{feed_iterations} and capture p95/mean query latency.",
        success_criteria:
          "Feed probe completes without failures and stays within configured latency thresholds."
      },
      %{
        name: "Channel fanout probe",
        command:
          "Run channel fanout probe with fanout_viewers=#{fanout_viewers} subscribers and measure broadcast delivery latency.",
        success_criteria:
          "All subscribers receive fanout payloads with no dropped deliveries."
      },
      %{
        name: "Live-session concurrency probe",
        command:
          "Run live join probe with concurrency_viewers=#{concurrency_viewers} concurrent join attempts and measure completion latency.",
        success_criteria:
          "Join attempts complete without authorization/runtime ownership regressions."
      }
    ]
  end

  @spec run(keyword()) ::
          :ok
          | {:dry_run, [drill_step()]}
          | {:error,
             :invalid_feed_iterations
             | :invalid_fanout_viewers
             | :invalid_concurrency_viewers
             | :confirmation_required
             | drill_failure()}
  def run(opts \\ []) do
    env = Keyword.get(opts, :env, Mix.env())
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)
    feed_iterations = Keyword.get(opts, :feed_iterations, @default_feed_iterations)
    fanout_viewers = Keyword.get(opts, :fanout_viewers, @default_fanout_viewers)
    concurrency_viewers = Keyword.get(opts, :concurrency_viewers, @default_concurrency_viewers)
    runner = Keyword.get(opts, :runner, &default_runner/1)

    with :ok <- validate_positive_integer(feed_iterations, :invalid_feed_iterations),
         :ok <- validate_positive_integer(fanout_viewers, :invalid_fanout_viewers),
         :ok <- validate_positive_integer(concurrency_viewers, :invalid_concurrency_viewers),
         :ok <- validate_confirmation(env, confirm?) do
      steps = command_plan(feed_iterations, fanout_viewers, concurrency_viewers)

      if dry_run? do
        {:dry_run, steps}
      else
        run_steps(steps, runner)
      end
    end
  end

  @spec format_step(drill_step()) :: String.t()
  def format_step(%{name: name, command: command, success_criteria: success_criteria}) do
    "#{name}: #{command} (success: #{success_criteria})"
  end

  @spec run_steps([drill_step()], runner_fun()) :: :ok | {:error, drill_failure()}
  defp run_steps([], _runner), do: :ok

  defp run_steps([step | remaining], runner) do
    # Fail fast so operators capture only the first broken probe as evidence.
    case runner.(step) do
      :ok -> run_steps(remaining, runner)
      {:error, reason} -> {:error, %{step: step, reason: reason}}
    end
  end

  defp validate_positive_integer(value, _error) when is_integer(value) and value > 0, do: :ok
  defp validate_positive_integer(_value, error), do: {:error, error}

  @spec validate_confirmation(atom(), boolean()) :: :ok | {:error, :confirmation_required}
  defp validate_confirmation(:test, _confirm?), do: :ok
  defp validate_confirmation(_env, true), do: :ok
  defp validate_confirmation(_env, false), do: {:error, :confirmation_required}

  @spec default_runner(drill_step()) :: :ok
  defp default_runner(step) when is_map(step) do
    Mix.shell().info("Executing capacity drill step: #{format_step(step)}")
    :ok
  end
end
