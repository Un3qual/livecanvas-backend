defmodule LC.Integration.Live.EndSessionChatRemovalAtomicityTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import LC.AccountsFixtures, only: [user_fixture: 1]

  alias LC.{Chat, Live}
  alias LC.Infra.Repo
  alias LC.TestSupport.Live.PeerRuntimeHelper
  alias LCSchemas.Accounts.User
  alias LCSchemas.Chat.LiveSessionTimelineEventState
  alias LCSchemas.Live.LiveSession

  test "serializes chat removal behind an ending session" do
    PeerRuntimeHelper.with_local_repo_auto_mode(fn ->
      host = user_fixture(%{email: unique_email("host")})
      sender = user_fixture(%{email: unique_email("sender")})
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      try do
        {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "keep"})
        test_pid = self()

        end_task =
          Task.async(fn ->
            Repo.transaction(fn ->
              locked_session =
                from(live_session in LiveSession,
                  where: live_session.id == ^session.id,
                  lock: "FOR UPDATE"
                )
                |> Repo.one!()

              send(test_pid, :end_session_locked)

              receive do
                :commit_session_end -> :ok
              after
                5_000 -> exit(:commit_session_end_timeout)
              end

              locked_session
              |> Ecto.Changeset.change(%{
                ended_at: DateTime.utc_now(),
                ended_reason: :host_ended,
                status: :ended
              })
              |> Repo.update!()
            end)
          end)

        assert_receive :end_session_locked

        removal_task =
          Task.async(fn ->
            send(test_pid, :removal_started)
            result = Chat.remove_timeline_chat_message(event, host, %{})
            send(test_pid, {:removal_result, result})
            result
          end)

        assert_receive :removal_started
        refute_receive {:removal_result, _result}, 100

        send(end_task.pid, :commit_session_end)
        assert {:ok, %LiveSession{status: :ended}} = Task.await(end_task, 5_000)
        assert {:error, :session_ended} = Task.await(removal_task, 5_000)

        assert %LiveSessionTimelineEventState{projection_state: :visible} =
                 Repo.get!(LiveSessionTimelineEventState, event.id)
      after
        if persisted_session = Repo.get(LiveSession, session.id) do
          Repo.delete!(persisted_session)
        end

        for user <- [sender, host], user = Repo.get(User, user.id) do
          Repo.delete!(user)
        end
      end
    end)
  end

  defp unique_email(prefix) when is_binary(prefix) do
    "#{prefix}-#{System.system_time(:microsecond)}-#{System.unique_integer([:positive, :monotonic])}@example.com"
  end
end
