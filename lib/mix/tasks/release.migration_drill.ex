defmodule Mix.Tasks.Release.MigrationDrill do
  use Mix.Task
  use Boundary, classify_to: LC

  alias LC.Release.{MigrationDrill, MixStep}

  @shortdoc "Runs migration rehearsal and rollback drill commands"
  @moduledoc """
  Runs a migration rehearsal pipeline:

    1. `mix ecto.create --quiet`
    2. `mix ecto.migrate --quiet`
    3. `mix ecto.rollback --step N --quiet`
    4. `mix ecto.migrate --quiet`

  Supported options:

    * `--step` rollback depth (default: 1)
    * `--confirm` required when environment is not `test`
    * `--dry-run` print ordered commands without executing them
  """

  @switches [step: :integer, confirm: :boolean, dry_run: :boolean]

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

    step = Keyword.get(opts, :step, 1)
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)

    case MigrationDrill.run(step: step, confirm: confirm?, dry_run: dry_run?) do
      :ok ->
        :ok

      {:dry_run, steps} ->
        Mix.shell().info("Release migration drill dry run (execution order):")
        Enum.each(steps, &Mix.shell().info("- #{MixStep.format(&1)}"))
        :ok

      {:error, :confirmation_required} ->
        Mix.raise(
          "release.migration_drill requires --confirm when MIX_ENV is not test (current: #{Mix.env()})"
        )

      {:error, %{step: failed_step, reason: reason}} ->
        Mix.raise(
          "release migration drill failed at #{MixStep.format(failed_step)}: #{format_reason(reason)}"
        )
    end
  end

  @spec format_reason(term()) :: String.t()
  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
end
