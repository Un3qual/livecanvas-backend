defmodule LC.Infra.DataGovernance.Retention do
  @moduledoc false

  import Ecto.Query, only: [from: 2]

  alias LC.Infra.Repo
  alias LCSchemas.Accounts.AuthEvent
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  @seconds_per_day 86_400
  @default_cutoff_days 30

  @type family :: :auth_events | :async_jobs | :webhook_events
  @type mode :: :dry_run | :apply
  @type action :: :count_only | :stubbed_delete
  @type family_report :: %{
          family: family(),
          table: String.t(),
          eligible_count: non_neg_integer(),
          action: action()
        }
  @type report :: %{
          mode: mode(),
          cutoff_days: pos_integer(),
          cutoff_at: DateTime.t(),
          deletion_stubbed?: true,
          families: [family_report()]
        }
  @type run_error :: :invalid_cutoff_days | :invalid_mode_combination

  @doc """
  Evaluates retention candidates for operational tables.

  Hard deletion is intentionally stubbed in this release slice. `--apply` mode
  reports the same candidate set as `--dry-run` while marking actions as
  deferred so rollout safety work can happen in a follow-up task.
  """
  @spec run(keyword()) :: {:ok, report()} | {:error, run_error()}
  def run(opts \\ []) when is_list(opts) do
    with {:ok, mode} <- normalize_mode(opts),
         {:ok, cutoff_days} <- normalize_cutoff_days(opts) do
      now = normalize_now(Keyword.get(opts, :now))
      cutoff_at = cutoff_at(now, cutoff_days)
      action = action_for_mode(mode)
      families = build_family_reports(cutoff_at, action)

      {:ok,
       %{
         mode: mode,
         cutoff_days: cutoff_days,
         cutoff_at: cutoff_at,
         deletion_stubbed?: true,
         families: families
       }}
    end
  end

  @spec normalize_mode(keyword()) :: {:ok, mode()} | {:error, :invalid_mode_combination}
  defp normalize_mode(opts) when is_list(opts) do
    apply? = Keyword.get(opts, :apply, false)
    dry_run? = Keyword.get(opts, :dry_run, false)

    cond do
      apply? and dry_run? ->
        {:error, :invalid_mode_combination}

      apply? ->
        {:ok, :apply}

      true ->
        {:ok, :dry_run}
    end
  end

  @spec normalize_cutoff_days(keyword()) :: {:ok, pos_integer()} | {:error, run_error()}
  defp normalize_cutoff_days(opts) when is_list(opts) do
    cutoff_days =
      Keyword.get(opts, :cutoff_days, config_value(:default_cutoff_days, @default_cutoff_days))

    if is_integer(cutoff_days) and cutoff_days > 0 do
      {:ok, cutoff_days}
    else
      {:error, :invalid_cutoff_days}
    end
  end

  @spec normalize_now(term()) :: DateTime.t()
  defp normalize_now(%DateTime{} = now), do: DateTime.truncate(now, :microsecond)
  defp normalize_now(_now), do: utc_now()

  @spec cutoff_at(DateTime.t(), pos_integer()) :: DateTime.t()
  defp cutoff_at(now, cutoff_days)
       when is_struct(now, DateTime) and is_integer(cutoff_days) and cutoff_days > 0 do
    DateTime.add(now, -cutoff_days * @seconds_per_day, :second)
    |> DateTime.truncate(:microsecond)
  end

  @spec action_for_mode(mode()) :: action()
  defp action_for_mode(:dry_run), do: :count_only
  defp action_for_mode(:apply), do: :stubbed_delete

  @spec build_family_reports(DateTime.t(), action()) :: [family_report()]
  defp build_family_reports(cutoff_at, action) when is_struct(cutoff_at, DateTime) do
    family_order()
    |> Enum.map(fn family ->
      %{
        family: family,
        table: Atom.to_string(family),
        eligible_count: count_candidates(family, cutoff_at),
        action: action
      }
    end)
  end

  defp family_order, do: [:auth_events, :async_jobs, :webhook_events]

  @spec count_candidates(family(), DateTime.t()) :: non_neg_integer()
  defp count_candidates(:auth_events, cutoff_at) do
    from(auth_event in AuthEvent, where: auth_event.inserted_at <= ^cutoff_at)
    |> Repo.aggregate(:count, :id)
  end

  defp count_candidates(:async_jobs, cutoff_at) do
    from(async_job in AsyncJob,
      where:
        async_job.status in [:completed, :failed] and
          not is_nil(async_job.completed_at) and
          async_job.completed_at <= ^cutoff_at
    )
    |> Repo.aggregate(:count, :id)
  end

  defp count_candidates(:webhook_events, cutoff_at) do
    from(webhook_event in WebhookEvent,
      where:
        webhook_event.status in [:processed, :failed] and
          not is_nil(webhook_event.processed_at) and
          webhook_event.processed_at <= ^cutoff_at
    )
    |> Repo.aggregate(:count, :id)
  end

  defp config_value(key, default) when is_atom(key) do
    __MODULE__
    |> Application.get_env(:live_canvas, [])
    |> Keyword.get(key, default)
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
