defmodule LC.Live do
  @moduledoc """
  The Live context.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.Infra.Repo
  alias LC.Live.{RuntimeRPC, SessionServer, SessionSupervisor}
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
  @type end_live_session_result :: {:ok, ended_live_session()} | {:error, changeset()}
  @type end_live_session_transition_result ::
          {:ok, ended_live_session(), boolean()} | {:error, changeset()}
  @type live_participant_result :: {:ok, LiveParticipant.t()} | {:error, changeset() | term()}
  @type leave_live_session_result :: :ok
  @type runtime_participants :: %{optional(pos_integer()) => SessionServer.participant()}
  @type runtime_rpc_error :: :remote_not_found | :remote_timeout | :remote_unreachable
  @type runtime_target :: {:local, pid()} | {:remote, String.t()}
  @type runtime_rpc_module :: module()
  @type session_server_lookup_result ::
          {:ok, pid()} | {:error, :not_found | {:owned_by_remote, String.t()}}

  @doc """
  Starts a persisted live session and boots its runtime process.
  """
  @spec start_live_session(User.t(), map()) :: live_session_result()
  def start_live_session(%User{id: host_id}, attrs) when is_integer(host_id) and is_map(attrs) do
    visibility = Map.get(attrs, :visibility, Map.get(attrs, "visibility"))

    # Always read suspension state from the database so stale in-memory user
    # structs cannot start sessions after moderation changes.
    result =
      if active_user?(host_id) do
        live_session_changeset =
          %LiveSession{}
          |> LiveSessionChanges.changeset(LiveSessionChanges.attrs_for_insert(host_id, attrs))

        Repo.transact(fn ->
          with {:ok, live_session} <- Repo.insert(live_session_changeset),
               {:ok, _pid} <- SessionSupervisor.start_session_server(live_session.id) do
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
  def mark_session_live_with_transition(%LiveSession{status: :ended} = live_session) do
    {:error, LiveSessionChanges.mark_live_changeset(live_session, now_utc())}
  end

  def mark_session_live_with_transition(%LiveSession{id: session_id})
      when is_integer(session_id) do
    now = now_utc()

    {updated_count, _} =
      from(live_session in LiveSession,
        where: live_session.id == ^session_id and live_session.status == :starting
      )
      |> Repo.update_all(set: [status: :live, started_at: now])

    case {updated_count, Repo.get(LiveSession, session_id)} do
      # A concurrent end transition can commit between the winning update and
      # the reload, but this caller still owns the starting-to-live transition.
      {1, %LiveSession{} = persisted_session} ->
        {:ok, persisted_session, true}

      {0, %LiveSession{status: :ended} = ended_session} ->
        {:error, LiveSessionChanges.mark_live_changeset(ended_session, now)}

      {0, %LiveSession{} = persisted_session} ->
        {:ok, persisted_session, false}

      {_updated_count, nil} ->
        {:error, :not_found}
    end
  end

  @doc """
  Marks a live session as ended and tears down runtime state.
  """
  @spec end_live_session(persisted_live_session()) :: end_live_session_result()
  def end_live_session(%LiveSession{} = live_session), do: end_live_session(live_session, %{})

  @spec end_live_session(persisted_live_session(), map()) :: end_live_session_result()
  def end_live_session(%LiveSession{} = live_session, attrs) when is_map(attrs) do
    case end_live_session_with_transition(live_session, attrs) do
      {:ok, ended_live_session, _transitioned?} -> {:ok, ended_live_session}
      {:error, _reason} = error -> error
    end
  end

  @spec end_live_session_with_transition(persisted_live_session()) ::
          end_live_session_transition_result()
  def end_live_session_with_transition(%LiveSession{} = live_session),
    do: end_live_session_with_transition(live_session, %{})

  @spec end_live_session_with_transition(persisted_live_session(), map()) ::
          end_live_session_transition_result()
  def end_live_session_with_transition(%LiveSession{id: session_id} = live_session, attrs)
      when is_integer(session_id) and is_map(attrs) do
    now = now_utc()
    changeset = LiveSessionChanges.end_changeset(live_session, attrs, now)

    result =
      if changeset.valid? do
        ended_reason = Ecto.Changeset.get_field(changeset, :ended_reason)

        {updated_count, _} =
          from(persisted_session in LiveSession,
            where: persisted_session.id == ^session_id and persisted_session.status != :ended
          )
          |> Repo.update_all(
            set: [status: :ended, ended_at: now, ended_reason: ended_reason]
          )

        ended_session = Repo.get!(LiveSession, session_id)
        :ok = maybe_stop_session_server(updated_count, session_id)
        {:ok, ended_session, updated_count == 1}
      else
        {:error, changeset}
      end

    :ok = emit_live_session_telemetry(:end, %{session_id: session_id}, normalize_transition_result(result))
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
    runtime_rpc = runtime_rpc_module(opts)

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
  def leave_live_session(%LiveSession{id: session_id}, %User{id: user_id})
      when is_integer(session_id) and is_integer(user_id) do
    now = now_utc()
    :ok = mark_live_participant_left(session_id, user_id, now)
    :ok = remove_runtime_participant(session_id, user_id)
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
    case SessionSupervisor.join_session_server(session_id, user_id, role) do
      :ok ->
        :ok

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, {:owned_by_remote, _owner_node}} ->
        {:error, :not_found}
    end
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
          runtime_rpc_module()
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

  @spec remove_runtime_participant(pos_integer(), pos_integer()) :: :ok
  defp remove_runtime_participant(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} ->
        # Disconnect cleanup is best-effort because runtime processes may race
        # with channel termination; durable `left_at` is the source of truth.
        safe_runtime_leave(pid, user_id)

      {:error, :not_found} ->
        :ok

      {:error, {:owned_by_remote, _owner_node}} ->
        :ok
    end
  end

  @spec safe_runtime_leave(pid(), pos_integer()) :: :ok
  defp safe_runtime_leave(pid, user_id) when is_pid(pid) and is_integer(user_id) do
    SessionServer.leave(pid, user_id)
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

  @spec join_runtime(
          runtime_target(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          runtime_rpc_module()
        ) :: :ok | {:error, runtime_rpc_error()}
  defp join_runtime({:local, pid}, _session_id, user_id, role, _runtime_rpc)
       when is_pid(pid) and is_integer(user_id) and is_atom(role) do
    SessionServer.join(pid, user_id, role)
  end

  defp join_runtime({:remote, owner_node}, session_id, user_id, role, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_integer(user_id) and
              is_atom(role) and is_atom(runtime_rpc) do
    with :ok <- remote_lookup(owner_node, session_id, runtime_rpc),
         :ok <- remote_join(owner_node, session_id, user_id, role, runtime_rpc) do
      :ok
    end
  end

  @spec join_runtime_with_retry(
          runtime_target(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          runtime_rpc_module()
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

  @spec remote_lookup(String.t(), pos_integer(), runtime_rpc_module()) ::
          :ok | {:error, runtime_rpc_error()}
  defp remote_lookup(owner_node, session_id, runtime_rpc)
       when is_binary(owner_node) and is_integer(session_id) and is_atom(runtime_rpc) do
    owner_node
    |> runtime_rpc.call(
      __MODULE__,
      :remote_lookup_session_server,
      [session_id],
      timeout: runtime_rpc_timeout_ms()
    )
    |> normalize_remote_response()
  end

  @spec remote_join(
          String.t(),
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          runtime_rpc_module()
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

  @spec runtime_rpc_module(keyword()) :: runtime_rpc_module()
  defp runtime_rpc_module(opts) when is_list(opts) do
    configured_runtime_rpc =
      Application.get_env(:live_canvas, __MODULE__, [])
      |> Keyword.get(:runtime_rpc, RuntimeRPC)

    case Keyword.get(opts, :runtime_rpc, configured_runtime_rpc) do
      runtime_rpc when is_atom(runtime_rpc) -> runtime_rpc
      _other -> RuntimeRPC
    end
  end

  @spec runtime_rpc_timeout_ms() :: pos_integer()
  defp runtime_rpc_timeout_ms do
    Application.get_env(:live_canvas, __MODULE__, [])
    |> Keyword.get(:runtime_rpc_timeout_ms, 5_000)
  end

  @type live_session_event :: :end | :join | :start
  @type live_session_event_result ::
          {:ok, LiveParticipant.t() | LiveSession.t()} | {:error, term()}

  @spec maybe_stop_session_server(non_neg_integer(), pos_integer()) :: :ok
  defp maybe_stop_session_server(1, session_id) when is_integer(session_id),
    do: SessionSupervisor.stop_session_server(session_id)

  defp maybe_stop_session_server(_updated_count, _session_id), do: :ok

  @spec normalize_transition_result(end_live_session_transition_result()) :: end_live_session_result()
  defp normalize_transition_result({:ok, live_session, _transitioned?}), do: {:ok, live_session}
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

  @spec active_user?(pos_integer()) :: boolean()
  defp active_user?(user_id) when is_integer(user_id) do
    from(user in User, where: user.id == ^user_id and is_nil(user.suspended_at), select: user.id)
    |> Repo.exists?()
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
