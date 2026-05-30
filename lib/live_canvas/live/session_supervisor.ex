defmodule LC.Live.SessionSupervisor do
  @moduledoc false

  alias LC.RealtimeRuntime
  alias LC.RealtimeRuntime.SessionServer

  @type initial_participants :: %{optional(pos_integer()) => SessionServer.participant()}
  @type remote_owner_error :: {:owned_by_remote, String.t()}
  @type lookup_error :: :not_found | remote_owner_error()
  @type start_option :: {:shard_id, RealtimeRuntime.shard_id()}

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    RealtimeRuntime.Supervisor.start_link(opts)
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
    RealtimeRuntime.start_session_runtime(session_id, initial_participants, opts)
  end

  @spec stop_session_server(pos_integer()) :: :ok
  def stop_session_server(session_id) when is_integer(session_id) do
    RealtimeRuntime.stop_session_runtime(session_id)
  end

  @spec lookup_session_server(pos_integer()) ::
          {:ok, pid()} | {:error, lookup_error()}
  def lookup_session_server(session_id) when is_integer(session_id) do
    RealtimeRuntime.lookup_session_runtime(session_id)
  end

  @spec join_session_server(
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role()
        ) :: :ok | {:error, lookup_error()}
  def join_session_server(session_id, user_id, role)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    RealtimeRuntime.join_session_runtime(session_id, user_id, role)
  end
end
