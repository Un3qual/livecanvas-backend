defmodule Mix.Tasks.Release.CapacityDrill do
  use Mix.Task
  use Boundary, classify_to: LC

  alias LC.Release.CapacityDrill

  @shortdoc "Prints/executes capacity verification drill steps"
  @moduledoc """
  Runs an operator-facing capacity verification checklist.

  Supported options:

    * `--feed-iterations` number of feed-query iterations for probe sizing (default: 200)
    * `--fanout-viewers` number of channel subscribers for fanout probe sizing (default: 50)
    * `--concurrency-viewers` number of concurrent live joins for probe sizing (default: 30)
    * `--confirm` required when environment is not `test`
    * `--dry-run` print ordered drill steps without executing them
  """

  @switches [
    feed_iterations: :integer,
    fanout_viewers: :integer,
    concurrency_viewers: :integer,
    confirm: :boolean,
    dry_run: :boolean
  ]

  @impl Mix.Task
  @spec run([String.t()]) :: :ok
  def run(args) do
    {opts, positional, invalid} = OptionParser.parse(args, switches: @switches)

    if positional != [] do
      Mix.raise("unexpected positional arguments: #{inspect(positional)}")
    end

    if invalid != [] do
      Mix.raise("invalid options: #{inspect(invalid)}")
    end

    feed_iterations = Keyword.get(opts, :feed_iterations, 200)
    fanout_viewers = Keyword.get(opts, :fanout_viewers, 50)
    concurrency_viewers = Keyword.get(opts, :concurrency_viewers, 30)
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)

    case CapacityDrill.run(
           feed_iterations: feed_iterations,
           fanout_viewers: fanout_viewers,
           concurrency_viewers: concurrency_viewers,
           confirm: confirm?,
           dry_run: dry_run?
         ) do
      :ok ->
        :ok

      {:dry_run, steps} ->
        Mix.shell().info("Release capacity drill dry run (execution order):")
        Enum.each(steps, &Mix.shell().info("- #{CapacityDrill.format_step(&1)}"))
        :ok

      {:error, :invalid_feed_iterations} ->
        Mix.raise("--feed-iterations must be a positive integer")

      {:error, :invalid_fanout_viewers} ->
        Mix.raise("--fanout-viewers must be a positive integer")

      {:error, :invalid_concurrency_viewers} ->
        Mix.raise("--concurrency-viewers must be a positive integer")

      {:error, :confirmation_required} ->
        Mix.raise(
          "release.capacity_drill requires --confirm when MIX_ENV is not test (current: #{Mix.env()})"
        )

      {:error, %{step: failed_step, reason: reason}} ->
        Mix.raise(
          "release capacity drill failed at #{CapacityDrill.format_step(failed_step)}: #{format_reason(reason)}"
        )
    end
  end

  @spec format_reason(term()) :: String.t()
  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
end
