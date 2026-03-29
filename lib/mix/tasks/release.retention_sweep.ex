defmodule Mix.Tasks.Release.RetentionSweep do
  use Mix.Task
  use Boundary, classify_to: LC

  alias LC.Infra.DataGovernance.Retention

  @shortdoc "Evaluates baseline retention candidates for operational tables"
  @moduledoc """
  Runs the retention sweep baseline for operational compliance tables.

  Supported options:

    * `--dry-run` - print candidate counts only (default mode)
    * `--apply` - explicit apply mode (currently stubbed and non-destructive, but gated)
    * `--cutoff-days` - positive integer override cutoff window in days for all families
  """

  @switches [dry_run: :boolean, apply: :boolean, cutoff_days: :integer]

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

    run_opts =
      opts
      |> Keyword.take([:apply, :dry_run, :cutoff_days])

    case Retention.run(run_opts) do
      {:ok, report} ->
        print_report(report)
        :ok

      {:error, :invalid_mode_combination} ->
        Mix.raise("choose either --dry-run or --apply, not both")

      {:error, :invalid_cutoff_days} ->
        Mix.raise("--cutoff-days must be a positive integer")

      {:error, :apply_mode_disabled} ->
        Mix.raise(
          "--apply is disabled by configuration (set LC.Infra.DataGovernance.Retention apply_mode_enabled=true for controlled drills)"
        )

      {:error, :incident_hold_active} ->
        Mix.raise("--apply is blocked because incident hold is active")
    end
  end

  @spec print_report(Retention.report()) :: :ok
  defp print_report(report) when is_map(report) do
    Mix.shell().info("Retention sweep mode: #{report.mode}")
    Mix.shell().info("Evaluation timestamp (UTC): #{DateTime.to_iso8601(report.evaluated_at)}")

    case report.cutoff_strategy do
      :policy_defaults ->
        Mix.shell().info("Cutoff strategy: policy_defaults")

      :override ->
        Mix.shell().info("Cutoff days override: #{report.cutoff_days}")
        Mix.shell().info("Cutoff timestamp (UTC): #{DateTime.to_iso8601(report.cutoff_at)}")
    end

    Enum.each(report.families, fn family ->
      Mix.shell().info(
        "- #{family.table}: #{family.eligible_count} eligible rows (#{format_action(family.action)}, hard_delete_executed=#{family.hard_delete_executed?}, cutoff_days=#{family.cutoff_days}, cutoff_at=#{DateTime.to_iso8601(family.cutoff_at)})"
      )
    end)

    if Map.get(report, :deletion_stubbed?, false) and
         not Map.get(report, :hard_delete_executed?, false) do
      Mix.shell().info("NOTE: hard deletion is currently stubbed; no rows were deleted.")
    end

    :ok
  end

  @spec format_action(Retention.action()) :: String.t()
  defp format_action(:count_only), do: "count_only"
  defp format_action(:stubbed_delete), do: "stubbed_delete"
end
