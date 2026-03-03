defmodule LC.Live do
  @moduledoc """
  The Live context.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  alias LC.Infra.Repo
  alias LC.Live.{SessionServer, SessionSupervisor}
  alias LC.Live.LiveParticipant, as: LiveParticipantChanges
  alias LC.Live.LiveSession, as: LiveSessionChanges
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.{LiveParticipant, LiveSession}

  @type changeset :: Ecto.Changeset.t()
  @type fetch_joinable_session_result :: {:ok, LiveSession.t()} | {:error, :ended | :not_found}
  @type live_session_result :: {:ok, LiveSession.t()} | {:error, changeset() | term()}
  @type live_participant_result :: {:ok, LiveParticipant.t()} | {:error, changeset() | term()}
  @type session_server_lookup_result :: {:ok, pid()} | {:error, :not_found}

  @doc """
  Starts a persisted live session and boots its runtime process.
  """
  @spec start_live_session(User.t(), map()) :: live_session_result()
  def start_live_session(%User{id: host_id}, attrs) when is_integer(host_id) and is_map(attrs) do
    live_session_changeset =
      %LiveSession{}
      |> LiveSessionChanges.changeset(LiveSessionChanges.attrs_for_insert(host_id, attrs))

    Repo.transact(fn ->
      with {:ok, live_session} <- Repo.insert(live_session_changeset),
           {:ok, _pid} <- SessionSupervisor.start_session_server(live_session.id) do
        {:ok, live_session}
      end
    end)
  end

  @doc """
  Marks a live session as started after media negotiation succeeds.
  """
  @spec mark_session_live(LiveSession.t()) :: live_session_result()
  def mark_session_live(%LiveSession{} = live_session) do
    live_session
    |> LiveSessionChanges.mark_live_changeset(now_utc())
    |> Repo.update()
  end

  @doc """
  Marks a live session as ended and tears down runtime state.
  """
  @spec end_live_session(LiveSession.t()) :: live_session_result()
  def end_live_session(%LiveSession{} = live_session), do: end_live_session(live_session, %{})

  @spec end_live_session(LiveSession.t(), map()) :: live_session_result()
  def end_live_session(%LiveSession{} = live_session, attrs) when is_map(attrs) do
    with {:ok, ended_session} <-
           live_session
           |> LiveSessionChanges.end_changeset(attrs, now_utc())
           |> Repo.update(),
         :ok <- SessionSupervisor.stop_session_server(live_session.id) do
      {:ok, ended_session}
    end
  end

  @doc """
  Persists and tracks a participant joining a live session.
  """
  @spec join_live_session(LiveSession.t(), User.t(), LCSchemas.Live.live_participant_role()) ::
          live_participant_result()
  def join_live_session(%LiveSession{id: session_id, status: :ended}, %User{id: user_id}, role)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    {:error, :ended}
  end

  def join_live_session(%LiveSession{id: session_id}, %User{id: user_id}, role)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    now = now_utc()

    with {:ok, pid} <- ensure_session_server(session_id),
         {:ok, participant} <- upsert_live_participant(session_id, user_id, role, now),
         :ok <- SessionServer.join(pid, user_id, role) do
      {:ok, participant}
    end
  end

  @doc """
  Locates the runtime server process for a persisted live session.
  """
  @spec lookup_session_server(pos_integer()) :: session_server_lookup_result()
  def lookup_session_server(session_id) when is_integer(session_id) do
    SessionSupervisor.lookup_session_server(session_id)
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

  defp ensure_session_server(session_id) do
    case SessionSupervisor.lookup_session_server(session_id) do
      {:ok, pid} -> {:ok, pid}
      {:error, :not_found} -> SessionSupervisor.start_session_server(session_id)
    end
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
