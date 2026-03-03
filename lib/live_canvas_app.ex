defmodule LCApp do
  @moduledoc false

  use Application

  use Boundary,
    top_level?: true,
    deps: [LC, LCWeb, LCGQL]

  @spec start(Application.start_type(), [term()]) :: Supervisor.on_start()
  @impl true
  def start(_type, _args) do
    children = [
      LCWeb.Telemetry,
      LC.repo_module(),
      {DNSCluster, query: Application.get_env(:live_canvas, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: LC.PubSub},
      {LC.Infra.SMS.FakeAdapter, []},
      LCWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: LC.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @spec config_change(keyword(), keyword(), keyword()) :: :ok
  @impl true
  def config_change(changed, _new, removed) do
    LCWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
