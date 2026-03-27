defmodule LCApp do
  @moduledoc false

  use Application

  use Boundary,
    top_level?: true,
    deps: [LC, LCWeb, LCGQL]

  alias Telemetry.Metrics.Summary

  @spec start(Application.start_type(), [term()]) :: Supervisor.on_start()
  @impl true
  def start(_type, _args) do
    base_children = [
      LCWeb.Telemetry,
      metrics_reporter_child(),
      LC.repo_module(),
      {LC.Accounts.ProviderAuth.JwksCache, []},
      {DNSCluster, query: Application.get_env(:live_canvas, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: LC.PubSub},
      LCWeb.Presence,
      {LC.Live.SessionSupervisor, []},
      {LC.Infra.SMS.FakeAdapter, []}
    ]

    children =
      base_children
      |> maybe_add_async_jobs_worker()
      |> Kernel.++([LCWeb.Endpoint])

    opts = [strategy: :one_for_one, name: LC.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @spec config_change(keyword(), keyword(), keyword()) :: :ok
  @impl true
  def config_change(changed, _new, removed) do
    LCWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp maybe_add_async_jobs_worker(children) when is_list(children) do
    worker_enabled? =
      LC.Infra.AsyncJobs.Worker
      |> Application.get_env(:live_canvas, [])
      |> Keyword.get(:enabled, true)

    if worker_enabled? do
      children ++ [{LC.Infra.AsyncJobs.Worker, []}]
    else
      children
    end
  end

  defp metrics_reporter_child do
    metrics_config = Application.get_env(:live_canvas, LCWeb.Plugs.MetricsAuth, [])

    # Register metrics synchronously so startup telemetry from later children is
    # visible on the first authorized scrape after rollout enablement.
    {TelemetryMetricsPrometheus.Core,
     name: Keyword.get(metrics_config, :reporter_name, :live_canvas_prometheus_metrics),
     metrics: prometheus_metrics(),
     start_async: false}
  end

  defp prometheus_metrics do
    LCWeb.Telemetry.metrics()
    |> Enum.reject(&match?(%Summary{}, &1))
  end
end
