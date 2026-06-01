defmodule LC.Infra.DataGovernance.Retention do
  @moduledoc false

  import Ecto.Query, only: [from: 2]

  alias LC.Infra.Repo
  alias LCSchemas.Accounts.AuthEvent
  alias LCSchemas.Chat.LiveSessionTimelineEvent
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}
  alias LCSchemas.Live.LiveParticipant

  @seconds_per_day 86_400
  @default_family_cutoff_days [
    auth_events: 365,
    async_jobs: 30,
    webhook_events: 90,
    live_session_timeline_events: 180,
    live_participants: 180
  ]
  @default_apply_mode_enabled false
  @default_incident_hold_active false

  @type family ::
          :auth_events
          | :async_jobs
          | :webhook_events
          | :live_session_timeline_events
          | :live_participants
  @type mode :: :dry_run | :apply
  @type cutoff_strategy :: :policy_defaults | :override
  @type action :: :count_only | :stubbed_delete
  @type family_report :: %{
          family: family(),
          table: String.t(),
          cutoff_days: pos_integer(),
          cutoff_at: DateTime.t(),
          eligible_count: non_neg_integer(),
          action: action()
        }
  @type report :: %{
          mode: mode(),
          cutoff_strategy: cutoff_strategy(),
          cutoff_days: pos_integer() | nil,
          cutoff_at: DateTime.t() | nil,
          evaluated_at: DateTime.t(),
          deletion_stubbed?: true,
          families: [family_report()]
        }
  @type run_error ::
          :invalid_cutoff_days
          | :invalid_mode_combination
          | :apply_mode_disabled
          | :incident_hold_active

  @doc """
  Evaluates retention candidates for operational tables.

  Hard deletion is intentionally stubbed in this release slice. `--apply` mode
  reports the same candidate set as `--dry-run` while marking actions as
  deferred so rollout safety work can happen in a follow-up task.
  """
  @spec run(keyword()) :: {:ok, report()} | {:error, run_error()}
  def run(opts \\ []) when is_list(opts) do
    with {:ok, mode} <- normalize_mode(opts),
         {:ok, cutoff_days_override} <- normalize_cutoff_days_override(opts),
         :ok <- ensure_apply_guardrails(mode) do
      evaluated_at = normalize_now(Keyword.get(opts, :now))

      {cutoff_strategy, cutoff_days, cutoff_at} =
        report_cutoff_summary(evaluated_at, cutoff_days_override)

      action = action_for_mode(mode)
      families = build_family_reports(evaluated_at, cutoff_days_override, action)

      {:ok,
       %{
         mode: mode,
         cutoff_strategy: cutoff_strategy,
         cutoff_days: cutoff_days,
         cutoff_at: cutoff_at,
         evaluated_at: evaluated_at,
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

  @spec normalize_cutoff_days_override(keyword()) ::
          {:ok, pos_integer() | nil} | {:error, run_error()}
  defp normalize_cutoff_days_override(opts) when is_list(opts) do
    if Keyword.has_key?(opts, :cutoff_days) do
      cutoff_days = Keyword.get(opts, :cutoff_days)

      if is_integer(cutoff_days) and cutoff_days > 0 do
        {:ok, cutoff_days}
      else
        {:error, :invalid_cutoff_days}
      end
    else
      {:ok, nil}
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

  @spec ensure_apply_guardrails(mode()) ::
          :ok | {:error, :apply_mode_disabled | :incident_hold_active}
  defp ensure_apply_guardrails(:dry_run), do: :ok

  defp ensure_apply_guardrails(:apply) do
    cond do
      incident_hold_active?() ->
        {:error, :incident_hold_active}

      not apply_mode_enabled?() ->
        {:error, :apply_mode_disabled}

      true ->
        :ok
    end
  end

  @spec build_family_reports(DateTime.t(), pos_integer() | nil, action()) :: [family_report()]
  defp build_family_reports(evaluated_at, cutoff_days_override, action)
       when is_struct(evaluated_at, DateTime) do
    configured_cutoffs = family_cutoff_days_map()

    family_order()
    |> Enum.map(fn family ->
      cutoff_days = cutoff_days_override || Map.fetch!(configured_cutoffs, family)
      cutoff_at = cutoff_at(evaluated_at, cutoff_days)

      %{
        family: family,
        table: Atom.to_string(family),
        cutoff_days: cutoff_days,
        cutoff_at: cutoff_at,
        eligible_count: count_candidates(family, cutoff_at),
        action: action
      }
    end)
  end

  defp family_order,
    do: [
      :auth_events,
      :async_jobs,
      :webhook_events,
      :live_session_timeline_events,
      :live_participants
    ]

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

  defp count_candidates(:live_session_timeline_events, cutoff_at) do
    from(timeline_event in LiveSessionTimelineEvent,
      where: timeline_event.occurred_at <= ^cutoff_at
    )
    |> Repo.aggregate(:count, :id)
  end

  defp count_candidates(:live_participants, cutoff_at) do
    # Only exited participants are retention candidates; active participation
    # rows (left_at = nil) are still part of current live-session state.
    from(live_participant in LiveParticipant,
      where: not is_nil(live_participant.left_at) and live_participant.left_at <= ^cutoff_at
    )
    |> Repo.aggregate(:count, :id)
  end

  @spec report_cutoff_summary(DateTime.t(), pos_integer() | nil) ::
          {cutoff_strategy(), pos_integer() | nil, DateTime.t() | nil}
  defp report_cutoff_summary(evaluated_at, nil) when is_struct(evaluated_at, DateTime),
    do: {:policy_defaults, nil, nil}

  defp report_cutoff_summary(evaluated_at, cutoff_days)
       when is_struct(evaluated_at, DateTime) and is_integer(cutoff_days) and cutoff_days > 0 do
    {:override, cutoff_days, cutoff_at(evaluated_at, cutoff_days)}
  end

  @spec family_cutoff_days_map() :: %{required(family()) => pos_integer()}
  defp family_cutoff_days_map do
    configured_cutoff_days =
      config_value(:family_cutoff_days, @default_family_cutoff_days)

    Enum.reduce(@default_family_cutoff_days, %{}, fn {family, default_cutoff_days}, acc ->
      configured_value =
        if Keyword.keyword?(configured_cutoff_days) do
          Keyword.get(configured_cutoff_days, family, default_cutoff_days)
        else
          default_cutoff_days
        end

      cutoff_days =
        if is_integer(configured_value) and configured_value > 0 do
          configured_value
        else
          default_cutoff_days
        end

      Map.put(acc, family, cutoff_days)
    end)
  end

  @spec apply_mode_enabled?() :: boolean()
  defp apply_mode_enabled?,
    do: config_boolean(:apply_mode_enabled, @default_apply_mode_enabled)

  @spec incident_hold_active?() :: boolean()
  defp incident_hold_active?,
    do: config_boolean(:incident_hold_active, @default_incident_hold_active)

  defp config_boolean(key, default) when is_atom(key) and is_boolean(default) do
    case config_value(key, default) do
      true -> true
      false -> false
      _ -> default
    end
  end

  defp config_value(key, default) when is_atom(key) do
    :live_canvas
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(key, default)
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
