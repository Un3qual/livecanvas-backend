defmodule LC.Infra.Repo.Migrations.CreateLiveMediaSessions do
  use Ecto.Migration

  def change do
    create table(:live_media_sessions) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :readiness_state, :string, null: false, default: "not_ready"
      add :ready_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:live_media_sessions, [:entropy_id])
    create unique_index(:live_media_sessions, [:live_session_id])

    create constraint(:live_media_sessions, :live_media_sessions_readiness_state_check,
             check: "readiness_state IN ('not_ready', 'ready')"
           )

    create constraint(:live_media_sessions, :live_media_sessions_ready_at_state_check,
             check:
               "(readiness_state = 'ready' AND ready_at IS NOT NULL) OR (readiness_state = 'not_ready' AND ready_at IS NULL)"
           )
  end
end
