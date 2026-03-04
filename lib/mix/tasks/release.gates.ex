defmodule Mix.Tasks.Release.Gates do
  use Mix.Task
  use Boundary, classify_to: LC

  alias LC.Release.Gates

  @shortdoc "Runs deterministic release preflight gates"
  @moduledoc """
  Runs the release preflight gate pipeline.

  Supported options:

    * `--dry-run` - print ordered gate commands without executing them
  """

  @switches [dry_run: :boolean]

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

    case Gates.run(dry_run: Keyword.get(opts, :dry_run, false)) do
      :ok ->
        :ok

      {:dry_run, steps} ->
        Mix.shell().info("Release gates dry run (execution order):")
        Enum.each(steps, &Mix.shell().info("- #{Gates.format_step(&1)}"))
        :ok

      {:error, %{step: step, reason: reason}} ->
        Mix.raise("release gates failed at #{Gates.format_step(step)}: #{format_reason(reason)}")
    end
  end

  @spec format_reason(term()) :: String.t()
  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
end
