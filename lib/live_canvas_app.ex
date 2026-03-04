defmodule LCApp do
  @moduledoc false

  use Application

  use Boundary,
    top_level?: true,
    deps: [LC, LCWeb, LCGQL]

  @spec start(Application.start_type(), [term()]) :: Supervisor.on_start()
  @impl true
  def start(_type, _args) do
    base_children = [
      LCWeb.Telemetry,
      LC.repo_module(),
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
end
