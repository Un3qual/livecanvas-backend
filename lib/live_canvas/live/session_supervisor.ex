defmodule LC.Live.SessionSupervisor do
  @moduledoc false

  use Supervisor

  alias LC.Live.{SessionOwnership, SessionServer}

  @registry LC.Live.SessionRegistry
  @dynamic_supervisor LC.Live.SessionDynamicSupervisor

  @type initial_participants :: %{optional(pos_integer()) => SessionServer.participant()}
  @type remote_owner_error :: {:owned_by_remote, String.t()}

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @spec start_session_server(pos_integer(), initial_participants()) ::
          {:ok, pid()} | {:error, term() | remote_owner_error()}
  def start_session_server(session_id, initial_participants \\ %{})

  def start_session_server(session_id, initial_participants)
      when is_integer(session_id) and is_map(initial_participants) do
    with :ok <- claim_local_ownership(session_id),
         {:ok, pid} <- start_runtime_child(session_id, initial_participants) do
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
          {:ok, pid()} | {:error, :not_found | remote_owner_error()}
  def lookup_session_server(session_id) when is_integer(session_id) do
    local_node_name = local_node_name()

    # Local runtime ownership takes precedence: if a pid is present and alive,
    # this node is the authoritative owner for session operations.
    case lookup_local_session_server(session_id) do
      {:ok, _pid} = result ->
        result

      {:error, :not_found} ->
        case SessionOwnership.get_owner(session_id, now_utc()) do
          {:ok, ^local_node_name} -> {:error, :not_found}
          {:ok, owner_node} -> {:error, {:owned_by_remote, owner_node}}
          {:error, :not_found} -> {:error, :not_found}
        end
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

  @spec start_runtime_child(pos_integer(), initial_participants()) ::
          {:ok, pid()} | {:error, term()}
  defp start_runtime_child(session_id, initial_participants)
       when is_integer(session_id) and is_map(initial_participants) do
    # Runtime session state is ephemeral; do not auto-restart ended sessions.
    child_spec =
      {SessionServer,
       session_id: session_id, registry: @registry, initial_participants: initial_participants}
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

  @spec local_node_name() :: String.t()
  defp local_node_name, do: Node.self() |> Atom.to_string()

  @spec now_utc() :: DateTime.t()
  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)

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
