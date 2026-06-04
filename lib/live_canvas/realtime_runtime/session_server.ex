defmodule LC.RealtimeRuntime.SessionServer do
  @moduledoc false

  use GenServer, restart: :temporary

  alias LCSchemas.Live.LiveSession

  @type media_bootstrap_result :: :ok | {:error, term()}
  @type media_bootstrap :: (LiveSession.t() -> media_bootstrap_result())
  @type media_negotiation_not_ready_reason :: :media_not_ready
  @type media_negotiation_readiness ::
          :ready | {:not_ready, media_negotiation_not_ready_reason()}
  @type call_error :: :not_found

  @type participant :: %{
          joined_at: DateTime.t(),
          role: LCSchemas.Live.live_participant_role(),
          user_id: pos_integer()
        }

  @type state :: %{
          media_negotiation_readiness: media_negotiation_readiness(),
          participants: %{optional(pos_integer()) => participant()},
          session_id: pos_integer()
        }

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) when is_list(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    registry = Keyword.get(opts, :registry, LC.RealtimeRuntime.SessionRegistry)
    media_bootstrap = Keyword.get(opts, :media_bootstrap, &default_media_bootstrap/1)
    initial_participants = Keyword.get(opts, :initial_participants, %{})

    GenServer.start_link(
      __MODULE__,
      %{
        session_id: session_id,
        media_bootstrap: media_bootstrap,
        initial_participants: initial_participants
      },
      name: via_tuple(registry, session_id)
    )
  end

  @spec join(pid(), pos_integer(), LCSchemas.Live.live_participant_role()) ::
          :ok | {:error, call_error()}
  def join(pid, user_id, role) when is_pid(pid) and is_integer(user_id) and is_atom(role) do
    safe_call(pid, {:join, user_id, role})
  end

  @spec leave(pid(), pos_integer()) :: :ok | {:error, call_error()}
  def leave(pid, user_id) when is_pid(pid) and is_integer(user_id) do
    safe_call(pid, {:leave, user_id})
  end

  @spec mark_media_negotiation_ready(pid()) :: :ok | {:error, call_error()}
  def mark_media_negotiation_ready(pid) when is_pid(pid) do
    safe_call(pid, :mark_media_negotiation_ready)
  end

  @spec media_negotiation_ready?(pid()) :: media_negotiation_readiness() | {:error, call_error()}
  def media_negotiation_ready?(pid) when is_pid(pid) do
    safe_call(pid, :media_negotiation_ready?)
  end

  @spec snapshot(pid()) :: state() | {:error, call_error()}
  def snapshot(pid) when is_pid(pid), do: safe_call(pid, :snapshot)

  @impl true
  @spec init(%{
          session_id: pos_integer(),
          media_bootstrap: media_bootstrap(),
          initial_participants: %{optional(pos_integer()) => participant()}
        }) ::
          {:ok, state()} | {:stop, {:media_bootstrap_failed, term()}}
  def init(%{
        session_id: session_id,
        media_bootstrap: media_bootstrap,
        initial_participants: initial_participants
      })
      when is_integer(session_id) and is_function(media_bootstrap, 1) and
             is_map(initial_participants) do
    case media_bootstrap.(%LiveSession{id: session_id}) do
      :ok ->
        state = %{
          session_id: session_id,
          media_negotiation_readiness: {:not_ready, :media_not_ready},
          participants: initial_participants
        }

        {:ok, state}

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
  @spec handle_call({:leave, pos_integer()}, GenServer.from(), state()) ::
          {:reply, :ok, state()}
  def handle_call({:leave, user_id}, _from, state) do
    {:reply, :ok, %{state | participants: Map.delete(state.participants, user_id)}}
  end

  @impl true
  @spec handle_call(:mark_media_negotiation_ready, GenServer.from(), state()) ::
          {:reply, :ok, state()}
  def handle_call(:mark_media_negotiation_ready, _from, state) do
    {:reply, :ok, %{state | media_negotiation_readiness: :ready}}
  end

  @impl true
  @spec handle_call(:media_negotiation_ready?, GenServer.from(), state()) ::
          {:reply, media_negotiation_readiness(), state()}
  def handle_call(:media_negotiation_ready?, _from, state) do
    {:reply, state.media_negotiation_readiness, state}
  end

  @impl true
  @spec handle_call(:snapshot, GenServer.from(), state()) :: {:reply, state(), state()}
  def handle_call(:snapshot, _from, state), do: {:reply, state, state}

  defp safe_call(pid, message) when is_pid(pid) do
    GenServer.call(pid, message)
  catch
    :exit, {:noproc, _details} -> {:error, :not_found}
    :exit, reason -> exit(reason)
  end

  defp via_tuple(registry, session_id), do: {:via, Registry, {registry, session_id}}

  @spec default_media_bootstrap(LiveSession.t()) :: :ok
  defp default_media_bootstrap(%LiveSession{}), do: :ok
end
