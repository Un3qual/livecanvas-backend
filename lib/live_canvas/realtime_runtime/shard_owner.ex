defmodule LC.RealtimeRuntime.ShardOwner do
  @moduledoc false

  use GenServer

  alias LC.RealtimeRuntime.SessionServer

  @registry LC.RealtimeRuntime.SessionRegistry
  @dynamic_supervisor LC.RealtimeRuntime.SessionDynamicSupervisor
  @default_global_claim_retry_interval_ms 1_000

  @type state :: %{
          shard_id: LC.RealtimeRuntime.shard_id(),
          registered?: boolean(),
          global_claim_retry_interval_ms: pos_integer()
        }

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

    retry_interval_ms =
      opts
      |> Keyword.get(:global_claim_retry_interval_ms, @default_global_claim_retry_interval_ms)
      |> normalize_retry_interval_ms()

    registered_state = %{
      shard_id: shard_id,
      registered?: true,
      global_claim_retry_interval_ms: retry_interval_ms
    }

    standby_state = %{
      shard_id: shard_id,
      registered?: false,
      global_claim_retry_interval_ms: retry_interval_ms
    }

    case GenServer.start_link(
           __MODULE__,
           registered_state,
           name: {:global, LC.RealtimeRuntime.global_shard_name(shard_id)}
         ) do
      {:ok, _pid} = started ->
        started

      {:error, {:already_started, _owner_pid}} ->
        GenServer.start_link(__MODULE__, standby_state)

      {:error, {:already_registered, _owner_pid}} ->
        GenServer.start_link(__MODULE__, standby_state)

      other ->
        other
    end
  end

  @impl true
  @spec init(state()) :: {:ok, state()}
  def init(%{registered?: true} = state), do: {:ok, state}

  def init(%{registered?: false} = state) do
    schedule_global_claim_retry(state)
    {:ok, state}
  end

  @impl true
  @spec handle_call(term(), GenServer.from(), state()) :: {:reply, term(), state()}
  def handle_call({:lookup_session_runtime, session_id}, _from, state)
      when is_integer(session_id) do
    {:reply, lookup_local_session_runtime(session_id), state}
  end

  def handle_call({:start_session_runtime, session_id, initial_participants, opts}, _from, state)
      when is_integer(session_id) and is_map(initial_participants) and is_list(opts) do
    {:reply, start_local_session_runtime(session_id, initial_participants, opts), state}
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

  @impl true
  @spec handle_info(term(), state()) :: {:noreply, state()}
  def handle_info(:claim_global_name, %{registered?: false, shard_id: shard_id} = state) do
    global_name = LC.RealtimeRuntime.global_shard_name(shard_id)

    case :global.whereis_name(global_name) do
      :undefined ->
        claim_global_name(global_name, state)

      pid when pid == self() ->
        {:noreply, %{state | registered?: true}}

      _owner_pid ->
        schedule_global_claim_retry(state)
        {:noreply, state}
    end
  end

  def handle_info(:claim_global_name, state), do: {:noreply, state}

  @spec start_local_session_runtime(
          pos_integer(),
          LC.RealtimeRuntime.initial_participants(),
          keyword()
        ) ::
          {:ok, pid()} | {:error, term()}
  defp start_local_session_runtime(session_id, initial_participants, opts)
       when is_integer(session_id) and is_map(initial_participants) and is_list(opts) do
    session_server_opts =
      [session_id: session_id, registry: @registry, initial_participants: initial_participants]
      |> Keyword.merge(Keyword.take(opts, [:media_bootstrap]))

    child_spec =
      {SessionServer, session_server_opts}
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

  @spec claim_global_name({module(), LC.RealtimeRuntime.shard_id()}, state()) ::
          {:noreply, state()}
  defp claim_global_name(global_name, state) do
    case :global.register_name(global_name, self()) do
      :yes ->
        {:noreply, %{state | registered?: true}}

      :no ->
        schedule_global_claim_retry(state)
        {:noreply, state}
    end
  end

  @spec schedule_global_claim_retry(state()) :: reference()
  defp schedule_global_claim_retry(%{
         global_claim_retry_interval_ms: retry_interval_ms
       }) do
    Process.send_after(self(), :claim_global_name, retry_interval_ms)
  end

  @spec normalize_retry_interval_ms(term()) :: pos_integer()
  defp normalize_retry_interval_ms(value) when is_integer(value) and value > 0, do: value
  defp normalize_retry_interval_ms(_value), do: @default_global_claim_retry_interval_ms
end
