defmodule Mix.Tasks.Release.LiveRuntimeDrill do
  use Mix.Task
  use Boundary, classify_to: LC

  alias LC.Release.LiveRuntimeDrill

  @shortdoc "Prints/executes runtime ownership failover rehearsal steps"
  @moduledoc """
  Runs an operator-facing runtime ownership failover rehearsal checklist.

  Supported options:

    * `--session-id` required live session ID to rehearse
    * `--takeover-node` optional node name expected to claim ownership during drill
    * `--confirm` required when environment is not `test`
    * `--dry-run` print ordered drill steps without executing them
  """

  @switches [session_id: :integer, takeover_node: :string, confirm: :boolean, dry_run: :boolean]

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

    session_id = Keyword.get(opts, :session_id)
    takeover_node = Keyword.get(opts, :takeover_node)
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)

    case LiveRuntimeDrill.run(
           session_id: session_id,
           takeover_node: takeover_node,
           confirm: confirm?,
           dry_run: dry_run?
         ) do
      :ok ->
        :ok

      {:dry_run, steps} ->
        Mix.shell().info("Release live runtime drill dry run (execution order):")
        Enum.each(steps, &Mix.shell().info("- #{LiveRuntimeDrill.format_step(&1)}"))
        :ok

      {:error, :session_id_required} ->
        Mix.raise("--session-id is required")

      {:error, :invalid_session_id} ->
        Mix.raise("--session-id must be a positive integer")

      {:error, :invalid_takeover_node} ->
        Mix.raise("--takeover-node must be a non-empty node name")

      {:error, :confirmation_required} ->
        Mix.raise(
          "release.live_runtime_drill requires --confirm when MIX_ENV is not test (current: #{Mix.env()})"
        )

      {:error, %{step: failed_step, reason: reason}} ->
        Mix.raise(
          "release live runtime drill failed at #{LiveRuntimeDrill.format_step(failed_step)}: #{format_reason(reason)}"
        )
    end
  end

  @spec format_reason(term()) :: String.t()
  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason)
end
