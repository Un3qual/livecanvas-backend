defmodule LC.Live do
  @moduledoc """
  The Live context.
  """

  use Boundary, deps: [LC.Content, LC.Infra, LC.ReadPolicy, LC.RealtimeRuntime, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.Content
  alias LC.Infra.Repo
  alias LC.ReadPolicy
  alias LC.Live.{MediaSession, MediaSignaling, RuntimeRPC, SessionSupervisor}
  alias LC.RealtimeRuntime.SessionServer
  alias LC.Live.LiveParticipant, as: LiveParticipantChanges
  alias LC.Live.LiveSession, as: LiveSessionChanges
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.{LiveParticipant, LiveSession}

  @type changeset :: Ecto.Changeset.t()
  @type persisted_live_session :: %LiveSession{id: pos_integer()}
  @type ended_live_session :: %LiveSession{
          id: pos_integer(),
          status: :ended,
          ended_at: DateTime.t(),
          ended_reason: LCSchemas.Live.live_session_end_reason()
        }
  @type fetch_joinable_session_result :: {:ok, LiveSession.t()} | {:error, :ended | :not_found}
  @type live_session_result :: {:ok, LiveSession.t()} | {:error, changeset() | term()}
  @type live_session_transition_result ::
          {:ok, LiveSession.t(), boolean()} | {:error, changeset() | term()}
  @type live_session_transition_effect :: (LiveSession.t(), boolean() ->
                                             :ok | {:ok, term()} | {:error, term()})
  @type live_session_transition_effect_result ::
          {:ok, LiveSession.t(), boolean(), term() | nil} | {:error, changeset() | term()}
  @type end_live_session_result :: {:ok, ended_live_session()} | {:error, changeset()}
  @type end_live_session_transition_result ::
          {:ok, ended_live_session(), boolean()} | {:error, changeset()}
  @type end_live_session_transition_effect_result ::
          {:ok, ended_live_session(), boolean(), term() | nil} | {:error, changeset() | term()}
  @type live_participant_result :: {:ok, LiveParticipant.t()} | {:error, changeset() | term()}
  @type leave_live_session_result :: :ok
  @type live_session_state :: %{
          status: LCSchemas.Live.live_session_status(),
          visibility: LCSchemas.Live.live_session_visibility(),
          viewer_count: non_neg_integer()
        }
  @type live_media_ice_server :: MediaSignaling.ice_server()
  @type live_media_payload :: MediaSignaling.media_payload()
  @type live_media_prepare_payload :: MediaSignaling.prepare_payload()
  @type live_media_prepare_result :: MediaSignaling.prepare_result()
  @type live_media_events :: MediaSignaling.media_events()
  @type live_media_validation_result ::
          MediaSignaling.validation_result(live_media_payload()) | {:error, :unknown_event}
  @type media_negotiation_readiness :: MediaSession.readiness()
  @type mark_media_negotiation_ready_result ::
          :ok | {:error, MediaSession.readiness_error() | Ecto.Changeset.t()}
  @type runtime_participants :: %{optional(pos_integer()) => SessionServer.participant()}
  @type runtime_rpc_error :: :remote_not_found | :remote_timeout | :remote_unreachable
  @type runtime_target :: {:local, pid()} | {:remote, String.t()}
  @type runtime_rpc_adapter :: module()
  @type start_live_session_option :: {:runtime_rpc, runtime_rpc_adapter()}
  @type end_live_session_option :: {:runtime_rpc, runtime_rpc_adapter()}
  @type leave_live_session_option :: {:runtime_rpc, runtime_rpc_adapter()}
  @type session_server_lookup_result ::
          {:ok, pid()} | {:error, :not_found | {:owned_by_remote, String.t()}}
  @type authorized_live_session_id_map :: %{optional(pos_integer()) => true}
  @type viewer_ref :: User.t() | %{required(:id) => pos_integer()}

  @doc """
  Returns the host media setup metadata for a live-session negotiation.
  """
  @spec prepare_live_media_session() :: live_media_prepare_result()
  def prepare_live_media_session, do: MediaSignaling.prepare_live_media_session()

  @doc """
  Returns the media signaling Phoenix event names without preparing ICE servers.
  """
  @spec media_events() :: live_media_events()
  def media_events, do: MediaSignaling.media_events()

  @doc """
  Validates an inbound live media signaling payload.
  """
  @spec validate_live_media_signal_payload(String.t(), term()) :: live_media_validation_result()
  def validate_live_media_signal_payload(event, payload) when is_binary(event),
    do: MediaSignaling.validate_event_payload(event, payload)

  @doc """
  Marks the in-process media negotiation seam ready for a live session.
  """
  @spec mark_media_negotiation_ready(pos_integer()) :: mark_media_negotiation_ready_result()
  def mark_media_negotiation_ready(session_id) when is_integer(session_id) do
    case MediaSession.mark_ready(session_id) do
      {:ok, _media_session} -> :ok
      {:error, _reason} = error -> error
    end
  end

  @doc """
  Returns whether durable media negotiation has been marked ready.
  """
  @spec media_negotiation_ready?(pos_integer()) :: media_negotiation_readiness()
  def media_negotiation_ready?(session_id) when is_integer(session_id) do
    MediaSession.readiness(session_id)
  end

  @doc """
  Returns whether a user currently has an active participant row for a live session.
  """
  @spec active_live_participant?(pos_integer(), pos_integer()) :: boolean()
  def active_live_participant?(session_id, user_id)
      when is_integer(session_id) and is_integer(user_id) do
    LiveParticipant
    |> where(
      [live_participant],
      live_participant.live_session_id == ^session_id and
        live_participant.user_id == ^user_id and
        is_nil(live_participant.left_at)
    )
    |> Repo.exists?()
  end

  @doc """
  Returns active viewer user IDs for a live session in deterministic join order.
  """
  @spec active_live_viewer_ids(pos_integer()) :: [pos_integer()]
  def active_live_viewer_ids(session_id) when is_integer(session_id) do
    from(live_participant in LiveParticipant,
      where:
        live_participant.live_session_id == ^session_id and
          live_participant.role == :viewer and
          is_nil(live_participant.left_at),
      order_by: [asc: live_participant.joined_at, asc: live_participant.id],
      select: live_participant.user_id
    )
    |> Repo.all()
  end

  @doc """
  Starts a persisted live session and boots its runtime process.
  """
  @spec start_live_session(User.t(), map()) :: live_session_result()
  @spec start_live_session(User.t(), map(), [start_live_session_option()]) ::
          live_session_result()
  def start_live_session(user, attrs, opts \\ [])

  def start_live_session(%User{id: host_id}, attrs, opts)
      when is_integer(host_id) and is_map(attrs) and is_list(opts) do
    visibility = Map.get(attrs, :visibility, Map.get(attrs, "visibility"))
    runtime_rpc = Keyword.get(opts, :runtime_rpc, RuntimeRPC)

    # Always read suspension state from the database so stale in-memory user
    # structs cannot start sessions after moderation changes.
    result =
      if active_user?(host_id) do
        live_session_changeset =
          %LiveSession{}
          |> LiveSessionChanges.changeset(LiveSessionChanges.attrs_for_insert(host_id, attrs))

        Repo.transact(fn ->
          with {:ok, live_session} <- Repo.insert(live_session_changeset),
               :ok <- start_live_session_runtime(live_session.id, runtime_rpc) do
            {:ok, live_session}
          end
        end)
      else
        {:error, :not_authorized}
      end

    :ok = emit_live_session_telemetry(:start, %{host_id: host_id, visibility: visibility}, result)
    result
  end

  @doc """
  Marks a live session as started after media negotiation succeeds.
  """
  @spec mark_session_live(persisted_live_session()) :: live_session_result()
  def mark_session_live(%LiveSession{} = live_session) do
    case mark_session_live_with_transition(live_session) do
      {:ok, updated_live_session, _transitioned?} -> {:ok, updated_live_session}
      {:error, _reason} = error -> error
    end
  end

  @doc """
  Marks a live session as started and reports whether this call won the
  persisted starting-to-live transition.
  """
  @spec mark_session_live_with_transition(persisted_live_session()) ::
          live_session_transition_result()
  def mark_session_live_with_transition(%LiveSession{} = live_session) do
    case mark_session_live_with_transition(live_session, &noop_transition_effect/2) do
      {:ok, updated_live_session, transitioned?, _effect_result} ->
        {:ok, updated_live_session, transitioned?}

      {:error, _reason} = error ->
        error
    end
  end

  @doc """
  Marks a live session as started and runs `transition_effect` before the
  persisted transition commits.
  """
  @spec mark_session_live_with_transition(
          persisted_live_session(),
          live_session_transition_effect()
        ) :: live_session_transition_effect_result()
  def mark_session_live_with_transition(
        %LiveSession{status: :ended} = live_session,
        transition_effect
      )
      when is_function(transition_effect, 2) do
    {:error, LiveSessionChanges.mark_live_changeset(live_session, now_utc())}
  end

  def mark_session_live_with_transition(%LiveSession{id: session_id}, transition_effect)
      when is_integer(session_id) and is_function(transition_effect, 2) do
    now = now_utc()

    case Repo.transact(fn ->
           {updated_count, _} =
             from(live_session in LiveSession,
               where: live_session.id == ^session_id and live_session.status == :starting
             )
             |> Repo.update_all(set: [status: :live, started_at: now])

           case {updated_count, Repo.get(LiveSession, session_id)} do
             # A concurrent end transition can commit between the winning update and
             # the reload, but this caller still owns the starting-to-live transition.
             {1, %LiveSession{} = persisted_session} ->
               {:ok, run_transition_effect(transition_effect, persisted_session, true)}

             {0, %LiveSession{status: :ended} = ended_session} ->
               Repo.rollback(LiveSessionChanges.mark_live_changeset(ended_session, now))

             {0, %LiveSession{} = persisted_session} ->
               {:ok, run_transition_effect(transition_effect, persisted_session, false)}

             {_updated_count, nil} ->
               Repo.rollback(:not_found)
           end
         end) do
      {:ok, {%LiveSession{} = persisted_session, transitioned?, effect_result}} ->
        {:ok, persisted_session, transitioned?, effect_result}

      {:error, _reason} = error ->
        error
    end
  end

  @doc """
  Marks a live session as started only when durable media negotiation is ready.
  """
  @spec mark_session_live_when_media_ready(
          persisted_live_session(),
          live_session_transition_effect()
        ) :: live_session_transition_effect_result()
  def mark_session_live_when_media_ready(%LiveSession{id: session_id}, transition_effect)
      when is_integer(session_id) and is_function(transition_effect, 2) do
    now = now_utc()

    case Repo.transact(fn ->
           case lock_live_session_for_update(session_id) do
             nil ->
               Repo.rollback(:not_found)

             %LiveSession{status: :ended} = ended_session ->
               Repo.rollback(LiveSessionChanges.mark_live_changeset(ended_session, now))

             %LiveSession{status: :starting} = persisted_session ->
               case MediaSession.readiness(session_id) do
                 :ready ->
                   persisted_session
                   |> LiveSessionChanges.mark_live_changeset(now)
                   |> Repo.update()
                   |> case do
                     {:ok, updated_session} ->
                       {:ok, run_transition_effect(transition_effect, updated_session, true)}

                     {:error, %Ecto.Changeset{} = changeset} ->
                       Repo.rollback(changeset)
                   end

                 {:not_ready, :media_not_ready} ->
                   Repo.rollback(:media_not_ready)
               end

             %LiveSession{} = persisted_session ->
               {:ok, run_transition_effect(transition_effect, persisted_session, false)}
           end
         end) do
      {:ok, {%LiveSession{} = persisted_session, transitioned?, effect_result}} ->
        {:ok, persisted_session, transitioned?, effect_result}

      {:error, _reason} = error ->
        error
    end
  end

  @doc """
  Marks a live session as ended and tears down runtime state.
  """
  @spec end_live_session(persisted_live_session()) :: end_live_session_result()
  def end_live_session(%LiveSession{} = live_session), do: end_live_session(live_session, %{}, [])

  @spec end_live_session(persisted_live_session(), map()) :: end_live_session_result()
  def end_live_session(%LiveSession{} = live_session, attrs),
    do: end_live_session(live_session, attrs, [])

  @spec end_live_session(persisted_live_session(), map(), [end_live_session_option()]) ::
          end_live_session_result()
  def end_live_session(%LiveSession{} = live_session, attrs, opts)
      when is_map(attrs) and is_list(opts) do
    case end_live_session_with_transition(live_session, attrs, opts) do
      {:ok, ended_live_session, _transitioned?} -> {:ok, ended_live_session}
      {:error, _reason} = error -> error
    end
  end

  @spec end_live_session_with_transition(persisted_live_session()) ::
          end_live_session_transition_result()
  def end_live_session_with_transition(%LiveSession{} = live_session),
    do: end_live_session_with_transition(live_session, %{}, [])

  @spec end_live_session_with_transition(persisted_live_session(), map()) ::
          end_live_session_transition_result()
  def end_live_session_with_transition(%LiveSession{} = live_session, attrs),
    do: end_live_session_with_transition(live_session, attrs, [])

  @spec end_live_session_with_transition(
          persisted_live_session(),
          map(),
          [end_live_session_option()]
        ) :: end_live_session_transition_result()
  def end_live_session_with_transition(%LiveSession{id: session_id} = live_session, attrs, opts)
      when is_integer(session_id) and is_map(attrs) and is_list(opts) do
    case end_live_session_with_transition(live_session, attrs, opts, &noop_transition_effect/2) do
      {:ok, ended_live_session, transitioned?, _effect_result} ->
        {:ok, ended_live_session, transitioned?}

      {:error, _reason} = error ->
        error
    end
  end

  @doc """
  Ends a live session and runs `transition_effect` before the persisted
  transition commits and before runtime teardown side effects run.
  """
  @spec end_live_session_with_transition(
          persisted_live_session(),
          map(),
          [end_live_session_option()],
          live_session_transition_effect()
        ) :: end_live_session_transition_effect_result()
  def end_live_session_with_transition(
        %LiveSession{id: session_id},
        attrs,
        opts,
        transition_effect
      )
      when is_integer(session_id) and is_map(attrs) and is_list(opts) and
             is_function(transition_effect, 2) do
    runtime_rpc = Keyword.get(opts, :runtime_rpc, RuntimeRPC)
    now = now_utc()
    # Lock the session row before validating the optional recording so a
    # concurrent asset delete cannot slip between validation and persistence.
    result =
      case Repo.transact(fn ->
             case lock_live_session_for_end(session_id) do
               nil ->
                 Repo.rollback(:not_found)

               %LiveSession{status: :ended} = ended_session ->
                 {:ok, run_transition_effect(transition_effect, ended_session, false)}

               %LiveSession{} = persisted_session ->
                 changeset =
                   persisted_session
                   |> LiveSessionChanges.end_changeset(attrs, now)
                   |> validate_recording_media_asset(persisted_session.host_id, lock: :for_update)

                 if changeset.valid? do
                   {:ok, ended_session} = Repo.update(changeset)
                   {:ok, run_transition_effect(transition_effect, ended_session, true)}
                 else
                   Repo.rollback(changeset)
                 end
             end
           end) do
        {:ok, {%LiveSession{} = ended_session, transitioned?, effect_result}} ->
          {:ok, ended_session, transitioned?, effect_result}

        {:error, reason} ->
          {:error, reason}
      end

    :ok =
      case result do
        {:ok, %LiveSession{}, true, _effect_result} ->
          maybe_stop_session_server(1, session_id, runtime_rpc)

        {:ok, %LiveSession{}, false, _effect_result} ->
          maybe_stop_session_server(0, session_id, runtime_rpc)

        {:error, _reason} ->
          :ok
      end

    :ok =
      emit_live_session_telemetry(
        :end,
        %{session_id: session_id},
        normalize_transition_result(result)
      )

    result
  end

  @doc """
  Persists and tracks a participant joining a live session.
  """
  @spec join_live_session(LiveSession.t(), User.t(), LCSchemas.Live.live_participant_role()) ::
          live_participant_result()
  def join_live_session(live_session, user, role),
    do: join_live_session(live_session, user, role, [])

  @spec join_live_session(
          LiveSession.t(),
          User.t(),
          LCSchemas.Live.live_participant_role(),
          keyword()
        ) :: live_participant_result()
  def join_live_session(
        %LiveSession{id: session_id, host_id: host_id, status: :ended},
        %User{id: user_id},
        role,
        opts
      )
      when is_integer(session_id) and is_integer(user_id) and is_integer(host_id) and
             is_atom(role) and is_list(opts) do
    result = {:error, :ended}

    :ok =
      emit_live_session_telemetry(
        :join,
        join_telemetry_metadata(session_id, user_id, host_id, role),
        result
      )

    result
  end

  def join_live_session(
        %LiveSession{id: session_id, host_id: host_id},
        %User{id: user_id},
        role,
        opts
      )
      when is_integer(session_id) and is_integer(user_id) and is_integer(host_id) and
             is_atom(role) and is_list(opts) do
    now = now_utc()
    telemetry_metadata = join_telemetry_metadata(session_id, user_id, host_id, role)
    runtime_rpc = Keyword.get(opts, :runtime_rpc, RuntimeRPC)

    # Channel callers can hold stale assigns, so moderation checks must be
    # re-evaluated from persisted suspension state at join time.
    result =
      with true <- active_user?(user_id) || {:error, :not_authorized},
           true <- active_user?(host_id) || {:error, :not_authorized},
           {:ok, runtime_target} <- ensure_session_server(session_id),
           {:ok, participant} <-
             upsert_live_participant_for_runtime_join(
               runtime_target,
               session_id,
               user_id,
               role,
               now,
               runtime_rpc
             ) do
        {:ok, participant}
      end

    :ok = emit_live_session_telemetry(:join, telemetry_metadata, result)
    result
  end

  @doc """
  Marks a participant as left and prunes their runtime membership.
  """
  @spec leave_live_session(LiveSession.t(), User.t()) :: leave_live_session_result()
  @spec leave_live_session(LiveSession.t(), User.t(), [leave_live_session_option()]) ::
          leave_live_session_result()
  def leave_live_session(live_session, user, opts \\ [])

  def leave_live_session(%LiveSession{id: session_id}, %User{id: user_id}, opts)
      when is_integer(session_id) and is_integer(user_id) and is_list(opts) do
    runtime_rpc = Keyword.get(opts, :runtime_rpc, RuntimeRPC)
    now = now_utc()
    :ok = mark_live_participant_left(session_id, user_id, now)
    :ok = remove_runtime_participant(session_id, user_id, runtime_rpc)
    :ok
  end

  @doc """
  Locates the runtime server process for a persisted live session.
  """
  @spec lookup_session_server(pos_integer()) :: session_server_lookup_result()
  def lookup_session_server(session_id) when is_integer(session_id) do
    SessionSupervisor.lookup_session_server(session_id)
  end

  @doc """
  Gets a live session by ID.
  """
  @spec get_live_session(pos_integer()) :: LiveSession.t() | nil
  def get_live_session(session_id) when is_integer(session_id),
    do: Repo.get(LiveSession, session_id)

  @doc """
  Gets a live session by ID and raises when it does not exist.
  """
  @spec get_live_session!(pos_integer()) :: LiveSession.t()
  def get_live_session!(session_id) when is_integer(session_id),
    do: Repo.get!(LiveSession, session_id)

  @doc """
  Returns a bounded aggregate snapshot for a persisted live session.
  """
  @spec live_session_state_snapshot(LiveSession.t()) :: live_session_state()
  @spec live_session_state_snapshot(LiveSession.t(), keyword()) :: live_session_state()
  def live_session_state_snapshot(
        %LiveSession{status: status, visibility: visibility} = live_session,
        opts \\ []
      )
      when status in [:starting, :live, :ended] and visibility in [:followers, :public] and
             is_list(opts) do
    runtime_rpc = Keyword.get(opts, :runtime_rpc, RuntimeRPC)

    case status do
      :ended ->
        bounded_live_session_state(live_session, 0)

      _other ->
        live_session_state_snapshot_from_runtime(live_session, runtime_rpc)
    end
  end

  @doc """
  Fetches a session that can still accept channel joins.
  """
  @spec fetch_joinable_session(pos_integer()) :: fetch_joinable_session_result()
  def fetch_joinable_session(session_id) when is_integer(session_id) do
    case Repo.get(LiveSession, session_id) do
      %LiveSession{status: :ended} -> {:error, :ended}
      %LiveSession{} = live_session -> {:ok, live_session}
      nil -> {:error, :not_found}
    end
  end

  @doc """
  Returns the active visible session IDs that may expose a channel topic to the viewer.
  """
  @spec authorized_live_session_channel_topic_ids(viewer_ref(), [map()]) ::
          authorized_live_session_id_map()
  def authorized_live_session_channel_topic_ids(viewer, live_sessions)
      when is_list(live_sessions) do
    live_sessions
    |> live_session_channel_topic_ids()
    |> visible_active_live_session_ids(viewer_ref_to_user(viewer))
  end

  def authorized_live_session_channel_topic_ids(_viewer, _live_sessions), do: %{}

  @doc false
  @spec remote_live_session_state_snapshot(pos_integer()) ::
          {:ok, live_session_state()} | {:error, :not_found}
  def remote_live_session_state_snapshot(session_id) when is_integer(session_id) do
    case Repo.get(LiveSession, session_id) do
      nil ->
        {:error, :not_found}

      %LiveSession{status: :ended} = live_session ->
        {:ok, bounded_live_session_state(live_session, 0)}

      %LiveSession{} = live_session ->
        {:ok, live_session_state_snapshot_from_local_runtime(live_session)}
    end
  end

  @doc false
  @spec remote_lookup_session_server(pos_integer()) :: :ok | {:error, :not_found}
  def remote_lookup_session_server(session_id) when is_integer(session_id) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, _pid} ->
        :ok

      {:error, :not_found} ->
        {:error, :not_found}

      # Returning `:not_found` keeps the cross-node contract deterministic even
      # if ownership changes between lookup and remote call execution.
      {:error, {:owned_by_remote, _owner_node}} ->
        {:error, :not_found}
    end
  end

  @doc false
  @spec remote_join_session_server(
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role()
        ) :: :ok | {:error, :not_found}
  def remote_join_session_server(session_id, user_id, role)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    case ensure_local_session_server(session_id) do
      {:ok, pid} ->
        SessionServer.join(pid, user_id, role)

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc false
  @spec remote_leave_session_server(pos_integer(), pos_integer()) :: :ok
  def remote_leave_session_server(session_id, user_id)
      when is_integer(session_id) and is_integer(user_id) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} ->
        safe_runtime_leave(pid, user_id)

      {:error, :not_found} ->
        :ok

      {:error, {:owned_by_remote, _owner_node}} ->
        :ok
    end
  end

  @doc false
  @spec remote_stop_session_server(pos_integer()) :: :ok
  def remote_stop_session_server(session_id) when is_integer(session_id) do
    case SessionSupervisor.stop_session_server(session_id) do
      :ok ->
        :ok

      # Stop RPCs are idempotent cleanup; if ownership moved again, the caller
      # should not fail the already-persisted end transition.
      {:error, {:owned_by_remote, _owner_node}} ->
        :ok
    end
  end

  @spec ensure_local_session_server(pos_integer()) :: {:ok, pid()} | {:error, :not_found}
  defp ensure_local_session_server(session_id) when is_integer(session_id) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} ->
        {:ok, pid}

      {:error, :not_found} ->
        session_id
        |> active_runtime_participants()
        |> then(&SessionSupervisor.start_session_server(session_id, &1))
        |> normalize_local_session_start()

      {:error, {:owned_by_remote, _owner_node}} ->
        {:error, :not_found}
    end
  end

  @spec normalize_local_session_start({:ok, pid()} | {:error, term()}) ::
          {:ok, pid()} | {:error, :not_found}
  defp normalize_local_session_start({:ok, pid}) when is_pid(pid), do: {:ok, pid}
  defp normalize_local_session_start({:error, _reason}), do: {:error, :not_found}

  @doc false
  @spec remote_start_session_server(pos_integer(), runtime_participants()) ::
          :ok | {:error, :not_found}
  def remote_start_session_server(session_id, initial_participants \\ %{})

  def remote_start_session_server(session_id, initial_participants)
      when is_integer(session_id) and is_map(initial_participants) do
    case SessionSupervisor.start_session_server(session_id, initial_participants) do
      {:ok, _pid} ->
        :ok

      {:error, :not_found} ->
        {:error, :not_found}

      # Ownership can move again before the RPC runs. Keep the cross-node
      # response stable and let the caller decide whether to retry.
      {:error, {:owned_by_remote, _owner_node}} ->
        {:error, :not_found}

      {:error, _reason} ->
        {:error, :not_found}
    end
  end

  @spec validate_recording_media_asset(Ecto.Changeset.t(), pos_integer() | nil, keyword()) ::
          Ecto.Changeset.t()
  defp validate_recording_media_asset(changeset, host_id, opts)
       when is_integer(host_id) and is_list(opts) do
    case Ecto.Changeset.get_field(changeset, :recording_media_asset_id) do
      nil ->
        changeset

      recording_media_asset_id ->
        case Content.fetch_live_recording_media_asset(host_id, recording_media_asset_id, opts) do
          {:ok, _media_asset} ->
            changeset

          {:error, :not_found} ->
            Ecto.Changeset.add_error(
              changeset,
              :recording_media_asset_id,
              "must belong to the session host"
            )

          {:error, :invalid_processing_state} ->
            Ecto.Changeset.add_error(
              changeset,
              :recording_media_asset_id,
              "must be uploaded or processed"
            )
        end
    end
  end

  defp validate_recording_media_asset(changeset, _host_id, _opts) do
    Ecto.Changeset.add_error(
      changeset,
      :recording_media_asset_id,
      "must belong to the session host"
    )
  end

  @spec lock_live_session_for_end(pos_integer()) :: LiveSession.t() | nil
  defp lock_live_session_for_end(session_id) when is_integer(session_id) do
    lock_live_session_for_update(session_id)
  end

  @spec lock_live_session_for_update(pos_integer()) :: LiveSession.t() | nil
  defp lock_live_session_for_update(session_id) when is_integer(session_id) do
    from(live_session in LiveSession,
      where: live_session.id == ^session_id,
      lock: "FOR UPDATE"
    )
    |> Repo.one()
  end

  defp upsert_live_participant(session_id, user_id, role, now) do
    attrs = LiveParticipantChanges.attrs_for_join(session_id, user_id, role, now)

    # Rejoins for an existing participant row should refresh role/join time in place.
    %LiveParticipant{}
    |> LiveParticipantChanges.changeset(attrs)
    |> Repo.insert(
      on_conflict: [
        set: [
          role: attrs.role,
          joined_at: attrs.joined_at,
          left_at: nil
        ]
      ],
      conflict_target: [:live_session_id, :user_id],
      returning: true
    )
  end

  @spec upsert_live_participant_for_runtime_join(
          runtime_target(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          DateTime.t(),
          runtime_rpc_adapter()
        ) :: {:ok, LiveParticipant.t()} | {:error, term()}
  defp upsert_live_participant_for_runtime_join(
         runtime_target,
         session_id,
         user_id,
         role,
         now,
         runtime_rpc
       )
       when is_integer(session_id) and is_integer(user_id) and is_atom(role) and
              is_struct(now, DateTime) and is_atom(runtime_rpc) do
    Repo.transact(fn ->
      # Keep durable participant persistence coupled to runtime admission so
      # failed remote handoff attempts do not leave ghost active participants.
      with {:ok, participant} <- upsert_live_participant(session_id, user_id, role, now),
           :ok <- join_runtime_with_retry(runtime_target, session_id, user_id, role, runtime_rpc) do
        {:ok, participant}
      else
        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @spec mark_live_participant_left(pos_integer(), pos_integer(), DateTime.t()) :: :ok
  defp mark_live_participant_left(session_id, user_id, now)
       when is_integer(session_id) and is_integer(user_id) do
    from(live_participant in LiveParticipant,
      where:
        live_participant.live_session_id == ^session_id and live_participant.user_id == ^user_id and
          is_nil(live_participant.left_at)
    )
    |> Repo.update_all(set: [left_at: now, updated_at: now])

    :ok
  end

  @spec remove_runtime_participant(pos_integer(), pos_integer(), runtime_rpc_adapter()) :: :ok
  defp remove_runtime_participant(session_id, user_id, runtime_rpc)
       when is_integer(session_id) and is_integer(user_id) and is_atom(runtime_rpc) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} ->
        # Disconnect cleanup is best-effort because runtime processes may race
        # with channel termination; durable `left_at` is the source of truth.
        safe_runtime_leave(pid, user_id)

      {:error, :not_found} ->
        :ok

      {:error, {:owned_by_remote, owner_node}} ->
        _result = remote_leave(owner_node, session_id, user_id, runtime_rpc)
        :ok
    end
  end

  @spec safe_runtime_leave(pid(), pos_integer()) :: :ok
  defp safe_runtime_leave(pid, user_id) when is_pid(pid) and is_integer(user_id) do
    _result = SessionServer.leave(pid, user_id)
    :ok
  catch
    :exit, _reason ->
      :ok
  end

  @spec ensure_session_server(pos_integer()) :: {:ok, runtime_target()} | {:error, term()}
  defp ensure_session_server(session_id) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} ->
        {:ok, {:local, pid}}

      {:error, {:owned_by_remote, owner_node}} ->
        {:ok, {:remote, owner_node}}

      {:error, :not_found} ->
        # Rehydrate runtime state from durable participants so a recreated
        # session process preserves active membership after crash/restart.
        runtime_participants = active_runtime_participants(session_id)

        case SessionSupervisor.start_session_server(session_id, runtime_participants) do
          {:ok, pid} -> {:ok, {:local, pid}}
          {:error, {:owned_by_remote, owner_node}} -> {:ok, {:remote, owner_node}}
          other -> other
        end
    end
  end

  @spec start_live_session_runtime(pos_integer(), runtime_rpc_adapter()) ::
          :ok | {:error, term()}
  defp start_live_session_runtime(session_id, runtime_rpc)
       when is_integer(session_id) and is_atom(runtime_rpc) do
    case SessionSupervisor.start_session_server(session_id) do
      {:ok, _pid} ->
        :ok

      {:error, {:owned_by_remote, owner_node}} ->
        remote_start(owner_node, session_id, %{}, runtime_rpc)

      {:error, _reason} = error ->
        error
    end
  end

  @spec join_runtime(
          runtime_target(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          runtime_rpc_adapter()
        ) :: :ok | {:error, runtime_rpc_error()}
  defp join_runtime({:local, pid}, _session_id, user_id, role, _runtime_rpc)
       when is_pid(pid) and is_integer(user_id) and is_atom(role) do
    SessionServer.join(pid, user_id, role)
  end

  defp join_runtime({:remote, owner_node}, session_id, user_id, role, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_integer(user_id) and
              is_atom(role) and is_atom(runtime_rpc) do
    remote_join(owner_node, session_id, user_id, role, runtime_rpc)
  end

  @spec join_runtime_with_retry(
          runtime_target(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          runtime_rpc_adapter()
        ) :: :ok | {:error, runtime_rpc_error()}
  defp join_runtime_with_retry(
         {:remote, _owner_node} = runtime_target,
         session_id,
         user_id,
         role,
         runtime_rpc
       )
       when is_integer(session_id) and is_integer(user_id) and is_atom(role) and
              is_atom(runtime_rpc) do
    case join_runtime(runtime_target, session_id, user_id, role, runtime_rpc) do
      {:error, :remote_not_found} ->
        # Partition healing can race with remote runtime restarts; retry one
        # remote admission attempt before surfacing the not-found outcome.
        case join_runtime(runtime_target, session_id, user_id, role, runtime_rpc) do
          :ok -> :ok
          {:error, _reason} -> {:error, :remote_not_found}
        end

      other ->
        other
    end
  end

  defp join_runtime_with_retry(runtime_target, session_id, user_id, role, runtime_rpc)
       when is_integer(session_id) and is_integer(user_id) and is_atom(role) and
              is_atom(runtime_rpc) do
    join_runtime(runtime_target, session_id, user_id, role, runtime_rpc)
  end

  @spec remote_join(
          String.t(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          runtime_rpc_adapter()
        ) :: :ok | {:error, runtime_rpc_error()}
  defp remote_join(owner_node, session_id, user_id, role, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_integer(user_id) and
              is_atom(role) and is_atom(runtime_rpc) do
    owner_node
    |> runtime_rpc.call(
      __MODULE__,
      :remote_join_session_server,
      [session_id, user_id, role],
      timeout: runtime_rpc_timeout_ms()
    )
    |> normalize_remote_response()
  end

  @spec remote_leave(String.t(), pos_integer(), pos_integer(), runtime_rpc_adapter()) ::
          :ok | {:error, runtime_rpc_error()}
  defp remote_leave(owner_node, session_id, user_id, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_integer(user_id) and
              is_atom(runtime_rpc) do
    owner_node
    |> runtime_rpc.call(
      __MODULE__,
      :remote_leave_session_server,
      [session_id, user_id],
      timeout: runtime_rpc_timeout_ms()
    )
    |> normalize_remote_response()
  end

  @spec remote_stop(String.t(), pos_integer(), runtime_rpc_adapter()) ::
          :ok | {:error, runtime_rpc_error()}
  defp remote_stop(owner_node, session_id, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_atom(runtime_rpc) do
    owner_node
    |> runtime_rpc.call(
      __MODULE__,
      :remote_stop_session_server,
      [session_id],
      timeout: runtime_rpc_timeout_ms()
    )
    |> normalize_remote_response()
  end

  @spec remote_start(
          String.t(),
          pos_integer(),
          runtime_participants(),
          runtime_rpc_adapter()
        ) :: :ok | {:error, runtime_rpc_error()}
  defp remote_start(owner_node, session_id, initial_participants, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_map(initial_participants) and
              is_atom(runtime_rpc) do
    owner_node
    |> runtime_rpc.call(
      __MODULE__,
      :remote_start_session_server,
      [session_id, initial_participants],
      timeout: runtime_rpc_timeout_ms()
    )
    |> normalize_remote_response()
  end

  @spec normalize_remote_response({:ok, term()} | {:error, RuntimeRPC.error_reason()}) ::
          :ok | {:error, runtime_rpc_error()}
  defp normalize_remote_response({:ok, :ok}), do: :ok
  defp normalize_remote_response({:ok, {:error, :not_found}}), do: {:error, :remote_not_found}

  defp normalize_remote_response({:ok, {:error, {:owned_by_remote, _owner_node}}}),
    do: {:error, :remote_not_found}

  defp normalize_remote_response({:error, reason})
       when reason in [:remote_not_found, :remote_timeout, :remote_unreachable] do
    {:error, reason}
  end

  defp normalize_remote_response(_response), do: {:error, :remote_not_found}

  @spec runtime_rpc_timeout_ms() :: pos_integer()
  defp runtime_rpc_timeout_ms do
    Application.get_env(:live_canvas, __MODULE__, [])
    |> Keyword.get(:runtime_rpc_timeout_ms, 5_000)
  end

  @spec live_session_state_snapshot_from_runtime(LiveSession.t(), runtime_rpc_adapter()) ::
          live_session_state()
  defp live_session_state_snapshot_from_runtime(
         %LiveSession{id: session_id} = live_session,
         runtime_rpc
       )
       when is_integer(session_id) and is_atom(runtime_rpc) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} ->
        viewer_count =
          case local_runtime_viewer_count(pid) do
            {:ok, count} -> count
            {:error, :not_found} -> active_viewer_count(session_id)
          end

        bounded_live_session_state(live_session, viewer_count)

      {:error, :not_found} ->
        bounded_live_session_state(live_session, active_viewer_count(session_id))

      {:error, {:owned_by_remote, owner_node}} ->
        case remote_live_session_state_snapshot(owner_node, session_id, runtime_rpc) do
          {:ok, snapshot} ->
            snapshot

          {:error, :remote_not_found} ->
            bounded_live_session_state(live_session, active_viewer_count(session_id))

          {:error, _reason} ->
            # Transport failures cannot prove current presence, so return a
            # deterministic zero rather than durable counts that may be stale.
            bounded_live_session_state(live_session, 0)
        end
    end
  end

  @spec live_session_state_snapshot_from_local_runtime(LiveSession.t()) :: live_session_state()
  defp live_session_state_snapshot_from_local_runtime(%LiveSession{id: session_id} = live_session)
       when is_integer(session_id) do
    viewer_count =
      case SessionSupervisor.lookup_session_server(session_id) do
        {:ok, pid} ->
          case local_runtime_viewer_count(pid) do
            {:ok, count} -> count
            {:error, :not_found} -> active_viewer_count(session_id)
          end

        {:error, :not_found} ->
          active_viewer_count(session_id)

        {:error, {:owned_by_remote, _owner_node}} ->
          # Ownership can change between the caller's lease read and this RPC,
          # so fall back to durable state instead of exposing routing details.
          active_viewer_count(session_id)
      end

    bounded_live_session_state(live_session, viewer_count)
  end

  @spec bounded_live_session_state(LiveSession.t(), non_neg_integer()) :: live_session_state()
  defp bounded_live_session_state(
         %LiveSession{status: status, visibility: visibility},
         viewer_count
       )
       when status in [:starting, :live, :ended] and visibility in [:followers, :public] and
              is_integer(viewer_count) and viewer_count >= 0 do
    %{
      status: status,
      visibility: visibility,
      viewer_count: viewer_count
    }
  end

  @spec local_runtime_viewer_count(pid()) :: {:ok, non_neg_integer()} | {:error, :not_found}
  defp local_runtime_viewer_count(pid) when is_pid(pid) do
    case SessionServer.snapshot(pid) do
      %{participants: _participants} = snapshot ->
        {:ok, snapshot_viewer_count(snapshot)}

      {:error, :not_found} ->
        {:error, :not_found}
    end
  catch
    :exit, _reason ->
      {:error, :not_found}
  end

  @spec snapshot_viewer_count(SessionServer.state()) :: non_neg_integer()
  defp snapshot_viewer_count(%{participants: participants}) when is_map(participants) do
    Enum.count(participants, fn
      {_user_id, %{role: :viewer}} -> true
      _other -> false
    end)
  end

  @spec remote_live_session_state_snapshot(String.t(), pos_integer(), runtime_rpc_adapter()) ::
          {:ok, live_session_state()} | {:error, runtime_rpc_error()}
  defp remote_live_session_state_snapshot(owner_node, session_id, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_atom(runtime_rpc) do
    owner_node
    |> runtime_rpc.call(
      __MODULE__,
      :remote_live_session_state_snapshot,
      [session_id],
      timeout: runtime_rpc_timeout_ms()
    )
    |> normalize_remote_live_session_state_response()
  end

  @spec normalize_remote_live_session_state_response(
          {:ok, {:ok, live_session_state()} | {:error, :not_found} | live_session_state()}
          | {:error, RuntimeRPC.error_reason()}
        ) :: {:ok, live_session_state()} | {:error, runtime_rpc_error()}
  defp normalize_remote_live_session_state_response(
         {:ok, {:ok, %{status: status, visibility: visibility, viewer_count: viewer_count}}}
       )
       when status in [:starting, :live, :ended] and visibility in [:followers, :public] and
              is_integer(viewer_count) and viewer_count >= 0 do
    {:ok,
     %{
       status: status,
       visibility: visibility,
       viewer_count: viewer_count
     }}
  end

  defp normalize_remote_live_session_state_response(
         {:ok, %{status: status, visibility: visibility, viewer_count: viewer_count}}
       )
       when status in [:starting, :live, :ended] and visibility in [:followers, :public] and
              is_integer(viewer_count) and viewer_count >= 0 do
    {:ok,
     %{
       status: status,
       visibility: visibility,
       viewer_count: viewer_count
     }}
  end

  defp normalize_remote_live_session_state_response({:ok, {:error, :not_found}}),
    do: {:error, :remote_not_found}

  defp normalize_remote_live_session_state_response({:error, reason})
       when reason in [:remote_not_found, :remote_timeout, :remote_unreachable] do
    {:error, reason}
  end

  defp normalize_remote_live_session_state_response(_response), do: {:error, :remote_not_found}

  @type live_session_event :: :end | :join | :start
  @type live_session_event_result ::
          {:ok, LiveParticipant.t() | LiveSession.t()} | {:error, term()}

  @spec maybe_stop_session_server(0 | 1, pos_integer(), runtime_rpc_adapter()) :: :ok
  defp maybe_stop_session_server(_updated_count, session_id, runtime_rpc)
       when is_integer(session_id) and is_atom(runtime_rpc) do
    case SessionSupervisor.stop_session_server(session_id) do
      :ok ->
        :ok

      {:error, {:owned_by_remote, owner_node}} ->
        _result = remote_stop(owner_node, session_id, runtime_rpc)
        :ok
    end
  end

  @spec noop_transition_effect(LiveSession.t(), boolean()) :: {:ok, nil}
  defp noop_transition_effect(%LiveSession{}, transitioned?) when is_boolean(transitioned?),
    do: {:ok, nil}

  @spec run_transition_effect(live_session_transition_effect(), LiveSession.t(), boolean()) ::
          {LiveSession.t(), boolean(), term() | nil} | no_return()
  defp run_transition_effect(transition_effect, %LiveSession{} = live_session, transitioned?)
       when is_function(transition_effect, 2) and is_boolean(transitioned?) do
    case transition_effect.(live_session, transitioned?) do
      :ok -> {live_session, transitioned?, nil}
      {:ok, effect_result} -> {live_session, transitioned?, effect_result}
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  @spec normalize_transition_result(end_live_session_transition_effect_result()) ::
          end_live_session_result()
  defp normalize_transition_result({:ok, live_session, _transitioned?, _effect_result}),
    do: {:ok, live_session}

  defp normalize_transition_result({:error, _reason} = error), do: error

  defp emit_live_session_telemetry(event, metadata, result)
       when event in [:start, :join, :end] and is_map(metadata) do
    # Observability is best-effort: event emission must not influence domain
    # outcomes, so metadata is normalized and bounded to non-secret fields.
    :telemetry.execute(
      [:live_canvas, :live, :session, event],
      %{count: 1},
      Map.merge(metadata, telemetry_outcome_metadata(result))
    )

    :ok
  end

  @spec telemetry_outcome_metadata(live_session_event_result()) :: map()
  defp telemetry_outcome_metadata({:ok, %LiveSession{id: session_id, status: status}}) do
    %{result: :ok, session_id: session_id, status: status}
  end

  defp telemetry_outcome_metadata(
         {:ok, %LiveParticipant{live_session_id: session_id, user_id: user_id}}
       ) do
    %{result: :ok, session_id: session_id, user_id: user_id}
  end

  defp telemetry_outcome_metadata({:error, reason}) do
    %{result: :error, reason: telemetry_reason(reason)}
  end

  @spec telemetry_reason(term()) :: atom()
  defp telemetry_reason(%Ecto.Changeset{}), do: :changeset
  defp telemetry_reason({reason, _detail}) when is_atom(reason), do: reason
  defp telemetry_reason(reason) when is_atom(reason), do: reason
  defp telemetry_reason(_reason), do: :unknown

  @spec join_telemetry_metadata(pos_integer(), pos_integer(), pos_integer(), atom()) :: map()
  defp join_telemetry_metadata(session_id, user_id, host_id, role)
       when is_integer(session_id) and is_integer(user_id) and is_integer(host_id) and
              is_atom(role) do
    %{session_id: session_id, user_id: user_id, host_id: host_id, role: role}
  end

  @spec active_runtime_participants(pos_integer()) :: runtime_participants()
  defp active_runtime_participants(session_id) when is_integer(session_id) do
    from(live_participant in LiveParticipant,
      where: live_participant.live_session_id == ^session_id and is_nil(live_participant.left_at),
      order_by: [asc: live_participant.joined_at, asc: live_participant.id],
      select: {live_participant.user_id, live_participant.role, live_participant.joined_at}
    )
    |> Repo.all()
    |> Map.new(fn {user_id, role, joined_at} ->
      {user_id, %{user_id: user_id, role: role, joined_at: joined_at}}
    end)
  end

  @spec active_viewer_count(pos_integer()) :: non_neg_integer()
  defp active_viewer_count(session_id) when is_integer(session_id) do
    from(live_participant in LiveParticipant,
      where:
        live_participant.live_session_id == ^session_id and
          live_participant.role == :viewer and
          is_nil(live_participant.left_at)
    )
    |> Repo.aggregate(:count, :id)
  end

  @spec live_session_channel_topic_ids([map()]) :: [pos_integer()]
  defp live_session_channel_topic_ids(live_sessions) when is_list(live_sessions) do
    live_sessions
    |> Enum.flat_map(fn
      %{id: session_id, status: status}
      when is_integer(session_id) and status in [:starting, :live] ->
        [session_id]

      _live_session ->
        []
    end)
    |> Enum.uniq()
  end

  @spec visible_active_live_session_ids([pos_integer()], User.t()) ::
          authorized_live_session_id_map()
  defp visible_active_live_session_ids([], %User{}), do: %{}
  defp visible_active_live_session_ids(_session_ids, nil), do: %{}

  defp visible_active_live_session_ids(session_ids, %User{} = viewer)
       when is_list(session_ids) do
    if active_user?(viewer.id) do
      LiveSession
      |> where(
        [live_session],
        live_session.id in ^session_ids and live_session.status in [:starting, :live]
      )
      |> ReadPolicy.visible_live_sessions_query(viewer)
      |> select([live_session], live_session.id)
      |> Repo.all()
      |> Map.new(&{&1, true})
    else
      %{}
    end
  end

  @spec viewer_ref_to_user(viewer_ref() | term()) :: User.t() | nil
  defp viewer_ref_to_user(%User{id: viewer_id} = viewer) when is_integer(viewer_id), do: viewer
  defp viewer_ref_to_user(%{id: viewer_id}) when is_integer(viewer_id), do: %User{id: viewer_id}
  defp viewer_ref_to_user(_viewer), do: nil

  @spec active_user?(pos_integer()) :: boolean()
  defp active_user?(user_id) when is_integer(user_id) do
    from(user in User, where: user.id == ^user_id and is_nil(user.suspended_at), select: user.id)
    |> Repo.exists?()
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
