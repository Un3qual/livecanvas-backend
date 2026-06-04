defmodule LC.Live.MediaSession do
  @moduledoc false

  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.{LiveMediaSession, LiveSession}

  @callback start_for_session(LiveSession.t()) :: :ok | {:error, term()}

  @type readiness :: :ready | {:not_ready, :media_not_ready}
  @type readiness_error :: :ended | :not_authorized | :not_found
  @type readiness_result ::
          {:ok, LiveMediaSession.t()} | {:error, readiness_error() | Ecto.Changeset.t()}
  @type attrs :: %{
          optional(:live_session_id) => pos_integer(),
          optional(:readiness_state) => LCSchemas.Live.live_media_readiness_state(),
          optional(:ready_at) => DateTime.t() | nil
        }

  @spec start_for_session(LiveSession.t()) :: :ok
  def start_for_session(%LiveSession{} = session) do
    # Placeholder seam for later Membrane pipeline startup.
    _ = session
    :ok
  end

  @spec ensure_readiness(LiveSession.t(), User.t()) :: readiness_result()
  def ensure_readiness(%LiveSession{id: session_id}, %User{id: user_id})
      when is_integer(session_id) and is_integer(user_id) do
    with_authorized_active_session(session_id, user_id, fn _live_session ->
      ensure_readiness_row(session_id)
    end)
  end

  @spec mark_ready(LiveSession.t(), User.t()) :: readiness_result()
  def mark_ready(%LiveSession{id: session_id}, %User{id: user_id})
      when is_integer(session_id) and is_integer(user_id) do
    mark_ready_for_user(session_id, user_id)
  end

  @spec mark_ready(pos_integer()) :: readiness_result()
  def mark_ready(session_id) when is_integer(session_id) do
    with_active_session(session_id, fn _live_session ->
      upsert_readiness_state(session_id, :ready, now_utc())
    end)
  end

  @spec reset_readiness(LiveSession.t(), User.t()) :: readiness_result()
  def reset_readiness(%LiveSession{id: session_id}, %User{id: user_id})
      when is_integer(session_id) and is_integer(user_id) do
    reset_readiness_for_user(session_id, user_id)
  end

  @spec reset_readiness(pos_integer()) :: readiness_result()
  def reset_readiness(session_id) when is_integer(session_id) do
    with_active_session(session_id, fn _live_session ->
      upsert_readiness_state(session_id, :not_ready, nil)
    end)
  end

  @spec readiness(LiveSession.t() | pos_integer()) :: readiness()
  def readiness(%LiveSession{id: session_id}) when is_integer(session_id),
    do: readiness(session_id)

  def readiness(session_id) when is_integer(session_id) do
    case Repo.get_by(LiveMediaSession, live_session_id: session_id) do
      %LiveMediaSession{readiness_state: :ready} -> :ready
      _not_ready_or_missing -> {:not_ready, :media_not_ready}
    end
  end

  @spec mark_ready_for_user(pos_integer(), pos_integer()) :: readiness_result()
  defp mark_ready_for_user(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id) do
    with_authorized_active_session(session_id, user_id, fn _live_session ->
      upsert_readiness_state(session_id, :ready, now_utc())
    end)
  end

  @spec reset_readiness_for_user(pos_integer(), pos_integer()) :: readiness_result()
  defp reset_readiness_for_user(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id) do
    with_authorized_active_session(session_id, user_id, fn _live_session ->
      upsert_readiness_state(session_id, :not_ready, nil)
    end)
  end

  @spec with_authorized_active_session(pos_integer(), pos_integer(), (LiveSession.t() ->
                                                                        readiness_result())) ::
          readiness_result()
  defp with_authorized_active_session(session_id, user_id, fun)
       when is_integer(session_id) and is_integer(user_id) and is_function(fun, 1) do
    with_active_session(session_id, fn %LiveSession{host_id: host_id} = live_session ->
      if host_id == user_id do
        fun.(live_session)
      else
        {:error, :not_authorized}
      end
    end)
  end

  @spec with_active_session(pos_integer(), (LiveSession.t() -> readiness_result())) ::
          readiness_result()
  defp with_active_session(session_id, fun)
       when is_integer(session_id) and is_function(fun, 1) do
    case Repo.transact(fn ->
           case lock_live_session(session_id) do
             nil ->
               Repo.rollback(:not_found)

             %LiveSession{status: :ended} ->
               Repo.rollback(:ended)

             %LiveSession{} = live_session ->
               case fun.(live_session) do
                 {:ok, %LiveMediaSession{} = media_session} -> {:ok, media_session}
                 {:error, reason} -> {:error, reason}
               end
           end
         end) do
      {:ok, %LiveMediaSession{} = media_session} -> {:ok, media_session}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec ensure_readiness_row(pos_integer()) :: readiness_result()
  defp ensure_readiness_row(session_id) when is_integer(session_id) do
    case Repo.get_by(LiveMediaSession, live_session_id: session_id) do
      %LiveMediaSession{} = media_session ->
        {:ok, media_session}

      nil ->
        insert_readiness_state(session_id, :not_ready, nil)
    end
  end

  @spec upsert_readiness_state(
          pos_integer(),
          LCSchemas.Live.live_media_readiness_state(),
          DateTime.t() | nil
        ) :: readiness_result()
  defp upsert_readiness_state(session_id, readiness_state, ready_at)
       when is_integer(session_id) and readiness_state in [:not_ready, :ready] do
    case Repo.get_by(LiveMediaSession, live_session_id: session_id) do
      %LiveMediaSession{} = media_session ->
        media_session
        |> changeset(%{readiness_state: readiness_state, ready_at: ready_at})
        |> Repo.update()

      nil ->
        insert_readiness_state(session_id, readiness_state, ready_at)
    end
  end

  @spec insert_readiness_state(
          pos_integer(),
          LCSchemas.Live.live_media_readiness_state(),
          DateTime.t() | nil
        ) :: readiness_result()
  defp insert_readiness_state(session_id, readiness_state, ready_at)
       when is_integer(session_id) and readiness_state in [:not_ready, :ready] do
    %LiveMediaSession{}
    |> changeset(%{
      live_session_id: session_id,
      readiness_state: readiness_state,
      ready_at: ready_at
    })
    |> Repo.insert()
  end

  @spec changeset(LiveMediaSession.t(), attrs()) :: Ecto.Changeset.t()
  defp changeset(%LiveMediaSession{} = media_session, attrs) when is_map(attrs) do
    media_session
    |> cast(attrs, [:live_session_id, :readiness_state, :ready_at])
    |> validate_required([:live_session_id, :readiness_state])
    |> validate_number(:live_session_id, greater_than: 0)
    |> validate_ready_at()
    |> foreign_key_constraint(:live_session_id)
    |> unique_constraint(:live_session_id)
    |> check_constraint(:readiness_state, name: :live_media_sessions_readiness_state_check)
    |> check_constraint(:ready_at, name: :live_media_sessions_ready_at_state_check)
  end

  @spec validate_ready_at(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  defp validate_ready_at(changeset) do
    readiness_state = get_field(changeset, :readiness_state)
    ready_at = get_field(changeset, :ready_at)

    case {readiness_state, ready_at} do
      {:ready, %DateTime{}} -> changeset
      {:ready, _ready_at} -> add_error(changeset, :ready_at, "must be present when ready")
      {:not_ready, nil} -> changeset
      {:not_ready, _ready_at} -> add_error(changeset, :ready_at, "must be empty when not ready")
      {_readiness_state, _ready_at} -> changeset
    end
  end

  @spec lock_live_session(pos_integer()) :: LiveSession.t() | nil
  defp lock_live_session(session_id) when is_integer(session_id) do
    from(live_session in LiveSession,
      where: live_session.id == ^session_id,
      lock: "FOR UPDATE"
    )
    |> Repo.one()
  end

  @spec now_utc() :: DateTime.t()
  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
