defmodule LC.RealtimeRuntime.ShardOwner do
  @moduledoc false

  use GenServer

  alias LC.RealtimeRuntime.SessionServer

  @registry LC.RealtimeRuntime.SessionRegistry
  @dynamic_supervisor LC.RealtimeRuntime.SessionDynamicSupervisor

  @type state :: %{shard_id: LC.RealtimeRuntime.shard_id()}

  @spec child_spec(keyword()) :: Supervisor.child_spec()
  def child_spec(opts) when is_list(opts) do
    shard_id = Keyword.fetch!(opts, :shard_id)

    %{
      id: {__MODULE__, shard_id},
      start: {__MODULE__, :start_link, [opts]},
      restart: :permanent,
      type: :worker
    }
  end

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) when is_list(opts) do
    shard_id = Keyword.fetch!(opts, :shard_id)

    state = %{shard_id: shard_id}

    case GenServer.start_link(
           __MODULE__,
           state,
           name: {:global, LC.RealtimeRuntime.global_shard_name(shard_id)}
         ) do
      {:ok, _pid} = started ->
        started

      {:error, {:already_started, _owner_pid}} ->
        GenServer.start_link(__MODULE__, state)

      {:error, {:already_registered, _owner_pid}} ->
        GenServer.start_link(__MODULE__, state)

      other ->
        other
    end
  end

  @impl true
  @spec init(state()) :: {:ok, state()}
  def init(state), do: {:ok, state}

  @impl true
  @spec handle_call(term(), GenServer.from(), state()) :: {:reply, term(), state()}
  def handle_call({:lookup_session_runtime, session_id}, _from, state)
      when is_integer(session_id) do
    {:reply, lookup_local_session_runtime(session_id), state}
  end

  def handle_call({:start_session_runtime, session_id, initial_participants}, _from, state)
      when is_integer(session_id) and is_map(initial_participants) do
    {:reply, start_local_session_runtime(session_id, initial_participants), state}
  end

  def handle_call({:stop_session_runtime, session_id}, _from, state)
      when is_integer(session_id) do
    {:reply, stop_local_session_runtime(session_id), state}
  end

  def handle_call({:join_session_runtime, session_id, user_id, role}, _from, state)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    result =
      with {:ok, pid} <- lookup_local_session_runtime(session_id) do
        SessionServer.join(pid, user_id, role)
      end

    {:reply, result, state}
  end

  @spec start_local_session_runtime(pos_integer(), LC.RealtimeRuntime.initial_participants()) ::
          {:ok, pid()} | {:error, term()}
  defp start_local_session_runtime(session_id, initial_participants)
       when is_integer(session_id) and is_map(initial_participants) do
    child_spec =
      {SessionServer,
       session_id: session_id, registry: @registry, initial_participants: initial_participants}
      |> Supervisor.child_spec(restart: :temporary, id: {SessionServer, session_id})

    case DynamicSupervisor.start_child(@dynamic_supervisor, child_spec) do
      {:ok, _pid} = result -> result
      {:error, {:already_started, pid}} -> {:ok, pid}
      other -> other
    end
  end

  @spec lookup_local_session_runtime(pos_integer()) :: {:ok, pid()} | {:error, :not_found}
  defp lookup_local_session_runtime(session_id) when is_integer(session_id) do
    case Registry.lookup(@registry, session_id) do
      [{pid, _value}] when is_pid(pid) ->
        if Process.alive?(pid), do: {:ok, pid}, else: {:error, :not_found}

      _ ->
        {:error, :not_found}
    end
  end

  @spec stop_local_session_runtime(pos_integer()) :: :ok
  defp stop_local_session_runtime(session_id) when is_integer(session_id) do
    case lookup_local_session_runtime(session_id) do
      {:ok, pid} ->
        case DynamicSupervisor.terminate_child(@dynamic_supervisor, pid) do
          :ok -> :ok
          {:error, :not_found} -> :ok
        end

      {:error, :not_found} ->
        :ok
    end
  end
end
