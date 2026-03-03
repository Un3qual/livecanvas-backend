defmodule LC.Live.SessionSupervisor do
  @moduledoc false

  use Supervisor

  alias LC.Live.SessionServer

  @registry LC.Live.SessionRegistry
  @dynamic_supervisor LC.Live.SessionDynamicSupervisor

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @spec start_session_server(pos_integer()) :: {:ok, pid()} | {:error, term()}
  def start_session_server(session_id) when is_integer(session_id) do
    # Runtime session state is ephemeral; do not auto-restart ended sessions.
    child_spec =
      {SessionServer, session_id: session_id, registry: @registry}
      |> Supervisor.child_spec(restart: :temporary, id: {SessionServer, session_id})

    case DynamicSupervisor.start_child(@dynamic_supervisor, child_spec) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, pid}} -> {:ok, pid}
      other -> other
    end
  end

  @spec stop_session_server(pos_integer()) :: :ok
  def stop_session_server(session_id) when is_integer(session_id) do
    case lookup_session_server(session_id) do
      {:ok, pid} ->
        case DynamicSupervisor.terminate_child(@dynamic_supervisor, pid) do
          :ok -> :ok
          {:error, :not_found} -> :ok
        end

      {:error, :not_found} ->
        :ok
    end
  end

  @spec lookup_session_server(pos_integer()) :: {:ok, pid()} | {:error, :not_found}
  def lookup_session_server(session_id) when is_integer(session_id) do
    case Registry.lookup(@registry, session_id) do
      [{pid, _value}] when is_pid(pid) -> {:ok, pid}
      _ -> {:error, :not_found}
    end
  end

  @impl true
  @spec init(:ok) :: {:ok, {Supervisor.sup_flags(), [Supervisor.child_spec()]}}
  def init(:ok) do
    children = [
      {Registry, keys: :unique, name: @registry},
      {DynamicSupervisor, strategy: :one_for_one, name: @dynamic_supervisor}
    ]

    Supervisor.init(children, strategy: :one_for_all)
  end
end
