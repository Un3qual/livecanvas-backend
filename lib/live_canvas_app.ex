defmodule LiveCanvasApp do
  @moduledoc false

  use Application

  use Boundary,
    top_level?: true,
    deps: [LiveCanvas, LiveCanvasWeb, LiveCanvasGQL]

  @impl true
  def start(_type, _args) do
    children = [
      LiveCanvasWeb.Telemetry,
      LiveCanvas.repo_module(),
      {DNSCluster, query: Application.get_env(:live_canvas, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: LiveCanvas.PubSub},
      LiveCanvasWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: LiveCanvas.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    LiveCanvasWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
