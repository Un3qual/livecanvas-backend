defmodule LC.Live.SessionServer do
  @moduledoc false

  alias LC.RealtimeRuntime.SessionServer, as: RuntimeSessionServer

  @type media_bootstrap_result :: RuntimeSessionServer.media_bootstrap_result()
  @type media_bootstrap :: RuntimeSessionServer.media_bootstrap()
  @type participant :: RuntimeSessionServer.participant()
  @type state :: RuntimeSessionServer.state()

  @spec child_spec(keyword()) :: Supervisor.child_spec()
  def child_spec(opts) when is_list(opts), do: RuntimeSessionServer.child_spec(opts)

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) when is_list(opts), do: RuntimeSessionServer.start_link(opts)

  @spec join(pid(), pos_integer(), LCSchemas.Live.live_participant_role()) :: :ok
  defdelegate join(pid, user_id, role), to: RuntimeSessionServer

  @spec leave(pid(), pos_integer()) :: :ok
  defdelegate leave(pid, user_id), to: RuntimeSessionServer

  @spec snapshot(pid()) :: state()
  defdelegate snapshot(pid), to: RuntimeSessionServer
end
