defmodule LC.Integration.Live.EndSessionRecordingAtomicityTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import LC.AccountsFixtures, only: [user_fixture: 1]
  import LC.ContentFixtures, only: [media_asset_fixture: 2]

  alias LC.Live
  alias LC.Infra.Repo
  alias LC.TestSupport.Live.PeerRuntimeHelper
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  test "returns a structured error when the recording asset disappears before the end write" do
    PeerRuntimeHelper.with_local_repo_auto_mode(fn ->
      host = user_fixture(%{email: unique_email("host")})

      try do
        session = live_session_fixture(host)
        recording_asset = recording_asset_fixture(host)
        session_id = session.id
        test_pid = self()

        lock_task =
          Task.async(fn ->
            Repo.transaction(fn ->
              from(live_session in LiveSession,
                where: live_session.id == ^session_id,
                lock: "FOR UPDATE"
              )
              |> Repo.one!()

              send(test_pid, :end_session_locked)

              receive do
                :release_end_session_lock -> :ok
              after
                5_000 -> exit(:release_end_session_lock_timeout)
              end
            end)
          end)

        assert_receive :end_session_locked

        end_task =
          Task.async(fn ->
            Live.end_live_session(session, %{
              ended_reason: :host_ended,
              recording_media_asset_id: recording_asset.id
            })
          end)

        Process.sleep(20)

        delete_task = Task.async(fn -> Repo.delete(recording_asset) end)

        assert {:ok, _deleted_recording_asset} = Task.await(delete_task, 5_000)

        send(lock_task.pid, :release_end_session_lock)
        assert {:ok, _lock_result} = Task.await(lock_task, 5_000)

        assert {:ok, {:error, changeset}} =
                 Task.yield(end_task, 5_000) || Task.shutdown(end_task, :brutal_kill)

        assert %{recording_media_asset_id: ["must belong to the session host"]} =
                 LC.DataCase.errors_on(changeset)

        assert %LiveSession{status: :starting, recording_media_asset_id: nil} =
                 Live.get_live_session!(session.id)
      after
        if user = Repo.get(User, host.id) do
          Repo.delete!(user)
        end
      end
    end)
  end

  defp live_session_fixture(host) do
    {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
    session
  end

  defp recording_asset_fixture(host) do
    recording_asset =
      media_asset_fixture(host, %{
        storage_key: "uploads/users/#{host.id}/recording-race.mp4",
        mime_type: "video/mp4",
        processing_state: :uploaded
      })

    recording_asset
  end

  defp unique_email(prefix) when is_binary(prefix) do
    "#{prefix}-#{System.system_time(:microsecond)}-#{System.unique_integer([:positive, :monotonic])}@example.com"
  end
end
