defmodule LC.Integration.Live.ChatEditRemovalLockOrderTest do
  use ExUnit.Case, async: false

  import LC.AccountsFixtures, only: [user_fixture: 1]

  alias LC.{Chat, Live}
  alias LC.Chat.TimelineEvents
  alias LC.Infra.Repo
  alias LC.TestSupport.Live.PeerRuntimeHelper
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  test "serializes concurrent chat edit and removal without a lock cycle" do
    PeerRuntimeHelper.with_local_repo_auto_mode(fn ->
      host = user_fixture(%{email: unique_email("host")})
      sender = user_fixture(%{email: unique_email("sender")})
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, task_supervisor} = Task.Supervisor.start_link()

      try do
        {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "before"})
        test_pid = self()

        edit_task =
          Task.Supervisor.async_nolink(task_supervisor, fn ->
            TimelineEvents.edit_chat_message(
              Repo,
              event,
              sender,
              %{body: "after"},
              fn _actor, _live_session ->
                send(test_pid, :edit_holds_session_lock)

                receive do
                  :continue_edit -> :ok
                after
                  5_000 -> exit(:continue_edit_timeout)
                end
              end
            )
          end)

        assert_receive :edit_holds_session_lock

        removal_task =
          Task.Supervisor.async_nolink(task_supervisor, fn ->
            %{rows: [[backend_pid]]} = Repo.query!("SELECT pg_backend_pid()")
            send(test_pid, {:removal_backend, backend_pid})

            TimelineEvents.remove_chat_message(
              Repo,
              event,
              host,
              %{},
              fn _live_session, _actor -> :ok end
            )
          end)

        assert_receive {:removal_backend, removal_backend_pid}
        assert_backend_waiting_on_lock(removal_backend_pid)
        send(edit_task.pid, :continue_edit)

        assert {:ok, %{body: "after"}} = await_task(edit_task)

        assert {:ok, %{removed_event_id: event_id, transitioned?: true}} =
                 await_task(removal_task)

        assert event_id == event.id
      after
        if Process.alive?(task_supervisor) do
          Supervisor.stop(task_supervisor)
        end

        if persisted_session = Repo.get(LiveSession, session.id) do
          Repo.delete!(persisted_session)
        end

        for user <- [sender, host], user = Repo.get(User, user.id) do
          Repo.delete!(user)
        end
      end
    end)
  end

  defp await_task(task) do
    case Task.yield(task, 5_000) || Task.shutdown(task) do
      {:ok, result} -> result
      {:exit, reason} -> flunk("concurrent chat mutation exited: #{inspect(reason)}")
      nil -> flunk("concurrent chat mutation timed out")
    end
  end

  defp assert_backend_waiting_on_lock(backend_pid, attempts \\ 100)

  defp assert_backend_waiting_on_lock(_backend_pid, 0) do
    flunk("removal transaction did not wait on the session lock")
  end

  defp assert_backend_waiting_on_lock(backend_pid, attempts) do
    case Repo.query!(
           "SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1",
           [backend_pid]
         ).rows do
      [["Lock"]] ->
        :ok

      _rows ->
        Process.sleep(10)
        assert_backend_waiting_on_lock(backend_pid, attempts - 1)
    end
  end

  defp unique_email(prefix) when is_binary(prefix) do
    "#{prefix}-#{System.system_time(:microsecond)}-#{System.unique_integer([:positive, :monotonic])}@example.com"
  end
end
