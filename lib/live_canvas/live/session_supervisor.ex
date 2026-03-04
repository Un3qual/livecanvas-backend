defmodule LC.Live.SessionSupervisor do
  @moduledoc false

  use Supervisor

  alias LC.Live.{SessionOwnership, SessionServer}

  @registry LC.Live.SessionRegistry
  @dynamic_supervisor LC.Live.SessionDynamicSupervisor
  @default_lease_heartbeat_interval_ms 10_000

  @type initial_participants :: %{optional(pos_integer()) => SessionServer.participant()}
  @type remote_owner_error :: {:owned_by_remote, String.t()}
  @type lookup_error :: :not_found | remote_owner_error()
  @type start_option :: {:lease_heartbeat_interval_ms, pos_integer()}

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @spec start_session_server(pos_integer()) ::
          {:ok, pid()} | {:error, term() | remote_owner_error()}
  def start_session_server(session_id), do: start_session_server(session_id, %{}, [])

  @spec start_session_server(pos_integer(), initial_participants()) ::
          {:ok, pid()} | {:error, term() | remote_owner_error()}
  def start_session_server(session_id, initial_participants),
    do: start_session_server(session_id, initial_participants, [])

  @spec start_session_server(pos_integer(), initial_participants(), [start_option()]) ::
          {:ok, pid()} | {:error, term() | remote_owner_error()}
  def start_session_server(session_id, initial_participants, opts)
      when is_integer(session_id) and is_map(initial_participants) and is_list(opts) do
    with :ok <- claim_local_ownership(session_id),
         {:ok, pid} <- start_runtime_child(session_id, initial_participants, opts) do
      {:ok, pid}
    else
      {:error, {:owned_by_remote, _owner_node}} = ownership_error ->
        ownership_error

      other ->
        # If runtime startup fails after the lease claim, drop the lease so
        # retrying callers are not blocked on a stale local ownership row.
        :ok = release_local_ownership(session_id)
        other
    end
  end

  @spec stop_session_server(pos_integer()) :: :ok
  def stop_session_server(session_id) when is_integer(session_id) do
    case lookup_local_session_server(session_id) do
      {:ok, pid} ->
        case DynamicSupervisor.terminate_child(@dynamic_supervisor, pid) do
          :ok -> :ok
          {:error, :not_found} -> :ok
        end

      {:error, :not_found} ->
        :ok
    end

    # Lease release is intentionally best-effort/idempotent so end-session
    # flows can safely clean up even if the runtime process already exited.
    :ok = release_local_ownership(session_id)
    :ok
  end

  @spec lookup_session_server(pos_integer()) ::
          {:ok, pid()} | {:error, lookup_error()}
  def lookup_session_server(session_id) when is_integer(session_id) do
    local_node_name = local_node_name()
    local_runtime = lookup_local_session_server(session_id)
    owner_lookup = SessionOwnership.get_owner(session_id, now_utc())

    case {local_runtime, owner_lookup} do
      {{:ok, pid}, {:ok, ^local_node_name}} ->
        {:ok, pid}

      {{:ok, pid}, {:ok, owner_node}} ->
        :ok = terminate_stale_local_runtime(session_id, pid)
        {:error, {:owned_by_remote, owner_node}}

      {{:ok, pid}, {:error, :not_found}} ->
        # A runtime process without an active lease can leak stale ownership.
        # Kill it so callers re-enter the claim/start path deterministically.
        :ok = terminate_stale_local_runtime(session_id, pid)
        {:error, :not_found}

      {{:error, :not_found}, {:ok, ^local_node_name}} ->
        {:error, :not_found}

      {{:error, :not_found}, {:ok, owner_node}} ->
        {:error, {:owned_by_remote, owner_node}}

      {{:error, :not_found}, {:error, :not_found}} ->
        {:error, :not_found}
    end
  end

  @spec join_session_server(
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role()
        ) :: :ok | {:error, lookup_error()}
  def join_session_server(session_id, user_id, role)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    with {:ok, pid} <- lookup_session_server(session_id) do
      SessionServer.join(pid, user_id, role)
    end
  end

  defp claim_local_ownership(session_id) when is_integer(session_id) do
    case SessionOwnership.claim(session_id, local_node_name(), now_utc()) do
      {:ok, _lease} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @spec release_local_ownership(pos_integer()) :: :ok
  defp release_local_ownership(session_id) when is_integer(session_id) do
    SessionOwnership.release(session_id, local_node_name())
  end

  @spec start_runtime_child(pos_integer(), initial_participants(), [start_option()]) ::
          {:ok, pid()} | {:error, term()}
  defp start_runtime_child(session_id, initial_participants, opts)
       when is_integer(session_id) and is_map(initial_participants) and is_list(opts) do
    heartbeat_interval_ms = lease_heartbeat_interval_ms(opts)

    # Runtime session state is ephemeral; do not auto-restart ended sessions.
    child_spec =
      {SessionServer,
       session_id: session_id,
       registry: @registry,
       initial_participants: initial_participants,
       lease_heartbeat: &refresh_local_ownership/1,
       lease_heartbeat_interval_ms: heartbeat_interval_ms}
      |> Supervisor.child_spec(restart: :temporary, id: {SessionServer, session_id})

    case DynamicSupervisor.start_child(@dynamic_supervisor, child_spec) do
      {:ok, _pid} = result ->
        result

      {:error, {:already_started, pid}} ->
        {:ok, pid}

      other ->
        other
    end
  end

  @spec lookup_local_session_server(pos_integer()) :: {:ok, pid()} | {:error, :not_found}
  defp lookup_local_session_server(session_id) when is_integer(session_id) do
    case Registry.lookup(@registry, session_id) do
      [{pid, _value}] when is_pid(pid) ->
        if Process.alive?(pid), do: {:ok, pid}, else: {:error, :not_found}

      _ ->
        {:error, :not_found}
    end
  end

  @spec terminate_stale_local_runtime(pos_integer(), pid()) :: :ok
  defp terminate_stale_local_runtime(session_id, pid)
       when is_integer(session_id) and is_pid(pid) do
    case DynamicSupervisor.terminate_child(@dynamic_supervisor, pid) do
      :ok -> :ok
      {:error, :not_found} -> :ok
    end

    :ok = release_local_ownership(session_id)
    :ok
  end

  @spec local_node_name() :: String.t()
  defp local_node_name, do: Node.self() |> Atom.to_string()

  @spec now_utc() :: DateTime.t()
  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)

  @spec refresh_local_ownership(pos_integer()) :: SessionServer.lease_heartbeat_result()
  defp refresh_local_ownership(session_id) when is_integer(session_id) do
    case SessionOwnership.refresh(session_id, local_node_name(), now_utc()) do
      {:ok, _lease} -> :ok
      {:error, :not_found} -> {:error, :lost_ownership}
      {:error, {:owned_by_remote, _owner_node}} -> {:error, :lost_ownership}
    end
  end

  @spec lease_heartbeat_interval_ms([start_option()]) :: pos_integer()
  defp lease_heartbeat_interval_ms(opts) when is_list(opts) do
    configured_interval =
      Application.get_env(:live_canvas, __MODULE__, [])
      |> Keyword.get(:lease_heartbeat_interval_ms, @default_lease_heartbeat_interval_ms)

    case Keyword.get(opts, :lease_heartbeat_interval_ms, configured_interval) do
      interval when is_integer(interval) and interval > 0 -> interval
      _ -> configured_interval
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
