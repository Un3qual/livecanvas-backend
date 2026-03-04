defmodule LC.Live.SessionServer do
  @moduledoc false

  use GenServer, restart: :temporary

  alias LC.Live.MediaSession
  alias LCSchemas.Live.LiveSession

  @type media_bootstrap_result :: :ok | {:error, term()}
  @type media_bootstrap :: (LiveSession.t() -> media_bootstrap_result())

  @type participant :: %{
          joined_at: DateTime.t(),
          role: LCSchemas.Live.live_participant_role(),
          user_id: pos_integer()
        }

  @type lease_heartbeat_result :: :ok | {:error, :lost_ownership}
  @type lease_heartbeat :: (pos_integer() -> lease_heartbeat_result())

  @type state :: %{
          lease_heartbeat: lease_heartbeat() | nil,
          lease_heartbeat_interval_ms: pos_integer() | nil,
          lease_heartbeat_timer_ref: reference() | nil,
          participants: %{optional(pos_integer()) => participant()},
          session_id: pos_integer()
        }

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) when is_list(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    registry = Keyword.get(opts, :registry, LC.Live.SessionRegistry)
    media_bootstrap = Keyword.get(opts, :media_bootstrap, &MediaSession.start_for_session/1)
    initial_participants = Keyword.get(opts, :initial_participants, %{})
    lease_heartbeat = Keyword.get(opts, :lease_heartbeat)
    lease_heartbeat_interval_ms = Keyword.get(opts, :lease_heartbeat_interval_ms)

    GenServer.start_link(
      __MODULE__,
      %{
        session_id: session_id,
        media_bootstrap: media_bootstrap,
        initial_participants: initial_participants,
        lease_heartbeat: lease_heartbeat,
        lease_heartbeat_interval_ms: lease_heartbeat_interval_ms
      },
      name: via_tuple(registry, session_id)
    )
  end

  @spec join(pid(), pos_integer(), LCSchemas.Live.live_participant_role()) :: :ok
  def join(pid, user_id, role) when is_pid(pid) and is_integer(user_id) and is_atom(role) do
    GenServer.call(pid, {:join, user_id, role})
  end

  @spec leave(pid(), pos_integer()) :: :ok
  def leave(pid, user_id) when is_pid(pid) and is_integer(user_id) do
    GenServer.call(pid, {:leave, user_id})
  end

  @spec snapshot(pid()) :: state()
  def snapshot(pid) when is_pid(pid), do: GenServer.call(pid, :snapshot)

  @impl true
  @spec init(%{
          session_id: pos_integer(),
          media_bootstrap: media_bootstrap(),
          initial_participants: %{optional(pos_integer()) => participant()},
          lease_heartbeat: lease_heartbeat() | nil,
          lease_heartbeat_interval_ms: pos_integer() | nil
        }) ::
          {:ok, state()} | {:stop, {:media_bootstrap_failed, term()}}
  def init(%{
        session_id: session_id,
        media_bootstrap: media_bootstrap,
        initial_participants: initial_participants,
        lease_heartbeat: lease_heartbeat,
        lease_heartbeat_interval_ms: lease_heartbeat_interval_ms
      })
      when is_integer(session_id) and is_function(media_bootstrap, 1) and
             is_map(initial_participants) do
    case media_bootstrap.(%LiveSession{id: session_id}) do
      :ok ->
        state = %{
          session_id: session_id,
          participants: initial_participants,
          lease_heartbeat: lease_heartbeat,
          lease_heartbeat_interval_ms: lease_heartbeat_interval_ms,
          lease_heartbeat_timer_ref: nil
        }

        {:ok, schedule_lease_heartbeat(state)}

      {:error, reason} ->
        # Startup should fail fast when media bootstrap cannot initialize.
        {:stop, {:media_bootstrap_failed, reason}}
    end
  end

  @impl true
  @spec handle_call(
          {:join, pos_integer(), LCSchemas.Live.live_participant_role()},
          GenServer.from(),
          state()
        ) ::
          {:reply, :ok, state()}
  def handle_call({:join, user_id, role}, _from, state) do
    participant = %{
      user_id: user_id,
      role: role,
      joined_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
    }

    participants = Map.put(state.participants, user_id, participant)

    {:reply, :ok, %{state | participants: participants}}
  end

  @impl true
  @spec handle_call({:leave, pos_integer()}, GenServer.from(), state()) :: {:reply, :ok, state()}
  def handle_call({:leave, user_id}, _from, state) do
    {:reply, :ok, %{state | participants: Map.delete(state.participants, user_id)}}
  end

  @impl true
  @spec handle_call(:snapshot, GenServer.from(), state()) :: {:reply, state(), state()}
  def handle_call(:snapshot, _from, state), do: {:reply, state, state}

  @impl true
  @spec handle_info(:refresh_lease_heartbeat, state()) ::
          {:noreply, state()} | {:stop, :lost_ownership, state()}
  def handle_info(:refresh_lease_heartbeat, state) do
    state = %{state | lease_heartbeat_timer_ref: nil}

    case run_lease_heartbeat(state) do
      :ok ->
        {:noreply, schedule_lease_heartbeat(state)}

      {:error, :lost_ownership} ->
        # Stop immediately to avoid split-brain behavior once this runtime can
        # no longer prove it is the active lease owner.
        {:stop, :lost_ownership, state}
    end
  end

  defp via_tuple(registry, session_id), do: {:via, Registry, {registry, session_id}}

  @spec run_lease_heartbeat(state()) :: lease_heartbeat_result()
  defp run_lease_heartbeat(%{lease_heartbeat: lease_heartbeat, session_id: session_id})
       when is_function(lease_heartbeat, 1) and is_integer(session_id) do
    lease_heartbeat.(session_id)
  end

  defp run_lease_heartbeat(_state), do: :ok

  @spec schedule_lease_heartbeat(state()) :: state()
  defp schedule_lease_heartbeat(
         %{lease_heartbeat: lease_heartbeat, lease_heartbeat_interval_ms: interval_ms} = state
       )
       when is_function(lease_heartbeat, 1) and is_integer(interval_ms) and interval_ms > 0 do
    timer_ref = Process.send_after(self(), :refresh_lease_heartbeat, interval_ms)
    %{state | lease_heartbeat_timer_ref: timer_ref}
  end

  defp schedule_lease_heartbeat(state), do: state
end
