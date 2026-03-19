defmodule LC.ChatTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures
  import Ecto.Query

  alias LC.{Accounts, Chat, Live, ReadPolicy}
  alias LCSchemas.Chat.ChatMessage

  describe "authorize_join/2" do
    test "denies join when viewer is suspended" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      assert {:ok, _suspended_viewer} = Accounts.suspend_user(viewer)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:error, :not_authorized} = Chat.authorize_join(viewer, session)
    end

    test "denies join when host is suspended" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, _suspended_host} = Accounts.suspend_user(host)

      assert {:error, :not_authorized} = Chat.authorize_join(viewer, session)
    end

    test "allows a followed viewer to join a followers-only session" do
      host = user_fixture()
      viewer = user_fixture()
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert :ok = Chat.authorize_join(viewer, session)
    end

    test "denies join when viewer has muted the host" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      _mute = mute_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:error, :not_authorized} = Chat.authorize_join(viewer, session)
    end

    test "denies join when the host has blocked the viewer" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      _block = block_fixture(host, viewer)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:error, :not_authorized} = Chat.authorize_join(viewer, session)
    end

    test "allows join when host has muted the viewer" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      _mute = mute_fixture(host, viewer)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert :ok = Chat.authorize_join(viewer, session)
    end
  end

  describe "create_message/3" do
    test "persists a chat message for the live session" do
      host = user_fixture()
      viewer = user_fixture()
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert :ok = Chat.authorize_join(viewer, session)
      assert {:ok, message} = Chat.create_message(session, viewer, %{body: "hello"})
      assert message.live_session_id == session.id
      assert message.sender_id == viewer.id
      assert message.body == "hello"
      assert message.kind == :user_message
      assert is_binary(message.entropy_id)

      assert %ChatMessage{id: persisted_id} = Repo.get!(ChatMessage, message.id)
      assert persisted_id == message.id
    end
  end

  describe "record_system_event/3" do
    test "persists a standardized session_live system event" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, system_event} =
               record_system_event(session, :session_live,
                 actor: host,
                 metadata: %{ignored: "value"}
               )

      assert system_event.live_session_id == session.id
      assert system_event.sender_id == host.id
      assert system_event.kind == :system_event
      assert system_event.status == :active
      assert system_event.body == "The live session started."
      assert system_event.metadata == %{"details" => %{}, "event_type" => "session_live"}

      assert %ChatMessage{} = Repo.get!(ChatMessage, system_event.id)
    end

    test "persists a standardized session_ended system event" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, ended_session} = Live.end_live_session(session)

      assert {:ok, system_event} =
               record_system_event(ended_session, :session_ended,
                 actor: host,
                 metadata: %{"ignored" => "value"}
               )

      assert system_event.live_session_id == ended_session.id
      assert system_event.sender_id == host.id
      assert system_event.kind == :system_event
      assert system_event.status == :active
      assert system_event.body == "The live session ended."
      assert system_event.metadata == %{"details" => %{}, "event_type" => "session_ended"}
    end

    test "persists a message_removed system event with bounded metadata" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, message} = Chat.create_message(session, viewer, %{body: "remove me"})

      assert {:ok, system_event} =
               record_system_event(session, :message_removed,
                 actor: host,
                 metadata: %{
                   "chat_message_entropy_id" => message.entropy_id,
                   chat_message_id: message.id,
                   ignored: "drop me"
                 }
               )

      assert system_event.live_session_id == session.id
      assert system_event.sender_id == host.id
      assert system_event.kind == :system_event
      assert system_event.status == :active
      assert system_event.body == "A chat message was removed."

      assert system_event.metadata == %{
               "details" => %{
                 "chat_message_entropy_id" => message.entropy_id,
                 "chat_message_id" => message.id
               },
               "event_type" => "message_removed"
             }
    end

    test "rejects malformed message_removed entropy ids" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, message} = Chat.create_message(session, viewer, %{body: "remove me"})

      assert {:error, :invalid_metadata} =
               record_system_event(session, :message_removed,
                 actor: host,
                 metadata: %{
                   "chat_message_entropy_id" => "not-a-uuid",
                   chat_message_id: message.id
                 }
               )

      refute Repo.exists?(
               from(chat_message in ChatMessage,
                 where:
                   chat_message.live_session_id == ^session.id and
                     chat_message.kind == :system_event
               )
             )
    end

    test "rejects unknown system event types" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:error, :unknown_event_type} =
               record_system_event(session, :viewer_joined,
                 actor: host,
                 metadata: %{viewer_id: host.id}
               )

      refute Repo.exists?(
               from(chat_message in ChatMessage,
                 where:
                   chat_message.live_session_id == ^session.id and
                     chat_message.kind == :system_event
               )
             )
    end
  end

  describe "authorize_history_access/2" do
    test "allows history reads for authorized viewers on live and ended sessions" do
      host = user_fixture()
      follower = user_fixture()
      _follow = accepted_follow_fixture(follower, host)
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, live_message} = Chat.create_message(live_session, host, %{body: "live"})
      assert :ok = Chat.authorize_history_access(host, live_session)
      assert :ok = Chat.authorize_history_access(follower, live_session)
      assert [^live_message] = Repo.all(Chat.history_query(live_session))

      {:ok, ended_session} = Live.end_live_session(live_session)

      assert :ok = Chat.authorize_history_access(host, ended_session)
      assert :ok = Chat.authorize_history_access(follower, ended_session)
      assert [^live_message] = Repo.all(Chat.history_query(ended_session))
    end

    test "allows public-session history reads for active viewers after the session ends" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, public_message} = Chat.create_message(live_session, host, %{body: "public"})
      assert :ok = Chat.authorize_history_access(viewer, live_session)
      assert [^public_message] = Repo.all(Chat.history_query(live_session))

      {:ok, ended_session} = Live.end_live_session(live_session)

      assert :ok = Chat.authorize_history_access(viewer, ended_session)
      assert [^public_message] = Repo.all(Chat.history_query(ended_session))
    end

    test "keeps block, mute, reverse-mute, and follower/public history visibility consistent" do
      viewer = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      followed_host = user_fixture()
      blocked_host = user_fixture(privacy_mode: :public)
      muted_host = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)

      _follow = accepted_follow_fixture(viewer, followed_host)
      _block = block_fixture(blocked_host, viewer)
      _mute = mute_fixture(viewer, muted_host)
      _reverse_mute = mute_fixture(reverse_muter, viewer)

      {:ok, public_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})
      {:ok, blocked_session} = Live.start_live_session(blocked_host, %{visibility: :public})
      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})

      {:ok, reverse_muted_session} =
        Live.start_live_session(reverse_muter, %{visibility: :public})

      {:ok, ended_public_session} = Live.end_live_session(public_session)
      {:ok, ended_followed_session} = Live.end_live_session(followed_session)
      {:ok, ended_blocked_session} = Live.end_live_session(blocked_session)
      {:ok, ended_muted_session} = Live.end_live_session(muted_session)
      {:ok, ended_reverse_muted_session} = Live.end_live_session(reverse_muted_session)

      assert :ok = Chat.authorize_history_access(viewer, ended_public_session)
      assert :ok = Chat.authorize_history_access(viewer, ended_followed_session)

      assert {:error, :not_authorized} =
               Chat.authorize_history_access(viewer, ended_blocked_session)

      assert {:error, :not_authorized} =
               Chat.authorize_history_access(viewer, ended_muted_session)

      assert :ok = Chat.authorize_history_access(viewer, ended_reverse_muted_session)
    end

    test "denies history reads for outsiders, suspended viewers, and muted viewers" do
      host = user_fixture()
      outsider = user_fixture()
      muted_viewer = user_fixture()
      suspended_viewer = user_fixture()
      _mute = mute_fixture(muted_viewer, host)
      {:ok, _suspended_viewer} = Accounts.suspend_user(suspended_viewer)
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, ended_session} = Live.end_live_session(live_session)

      assert {:error, :not_authorized} = Chat.authorize_history_access(outsider, live_session)
      assert {:error, :not_authorized} = Chat.authorize_history_access(outsider, ended_session)

      assert {:error, :not_authorized} =
               Chat.authorize_history_access(suspended_viewer, ended_session)

      assert {:error, :not_authorized} =
               Chat.authorize_history_access(muted_viewer, ended_session)
    end

    test "matches the shared read-policy session-visibility helper" do
      viewer = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      followed_host = user_fixture()
      blocked_host = user_fixture(privacy_mode: :public)
      muted_host = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)

      _follow = accepted_follow_fixture(viewer, followed_host)
      _block = block_fixture(blocked_host, viewer)
      _mute = mute_fixture(viewer, muted_host)
      _reverse_mute = mute_fixture(reverse_muter, viewer)

      assert ReadPolicy.viewer_can_read_owner?(viewer, public_host, :public)
      assert ReadPolicy.viewer_can_read_owner?(viewer, followed_host, :followers)
      refute ReadPolicy.viewer_can_read_owner?(viewer, blocked_host, :public)
      refute ReadPolicy.viewer_can_read_owner?(viewer, muted_host, :public)
      assert ReadPolicy.viewer_can_read_owner?(viewer, reverse_muter, :public)
    end
  end

  describe "history_query/1" do
    test "orders chat messages by inserted_at and id for stable cursor generation" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, first} = Chat.create_message(session, host, %{body: "first"})
      assert {:ok, second} = Chat.create_message(session, viewer, %{body: "second"})
      assert {:ok, third} = Chat.create_message(session, viewer, %{body: "third"})

      shared_time = ~U[2026-03-17 12:00:00.000000Z]
      later_time = DateTime.add(shared_time, 1, :second)

      {1, nil} =
        Repo.update_all(from(message in ChatMessage, where: message.id == ^first.id),
          set: [inserted_at: shared_time, updated_at: shared_time]
        )

      {1, nil} =
        Repo.update_all(from(message in ChatMessage, where: message.id == ^second.id),
          set: [inserted_at: shared_time, updated_at: shared_time]
        )

      {1, nil} =
        Repo.update_all(from(message in ChatMessage, where: message.id == ^third.id),
          set: [inserted_at: later_time, updated_at: later_time]
        )

      ordered_bodies =
        session
        |> Chat.history_query()
        |> Repo.all()
        |> Enum.map(& &1.body)

      assert ordered_bodies == ["first", "second", "third"]
    end
  end

  describe "remove_message/2" do
    test "lets the session host remove a retained message and repeats idempotently" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, message} = Chat.create_message(session, viewer, %{body: "remove me"})

      assert {:ok, removed_message} = remove_message(message, host)
      assert Map.get(removed_message, :status) == :removed
      assert Map.get(removed_message, :moderated_by_id) == host.id
      assert match?(%DateTime{}, Map.get(removed_message, :moderated_at))
      assert removed_message.body == "remove me"

      persisted_message = Repo.get!(ChatMessage, message.id)
      assert Map.get(persisted_message, :status) == :removed
      assert Map.get(persisted_message, :moderated_by_id) == host.id

      assert {:ok, repeated_message} = remove_message(removed_message, host)
      assert repeated_message.id == removed_message.id
      assert Map.get(repeated_message, :status) == :removed

      assert DateTime.compare(
               Map.get(repeated_message, :moderated_at),
               Map.get(removed_message, :moderated_at)
             ) == :eq
    end

    test "rejects sender and outsider attempts when they do not host the session" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      outsider = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, message} = Chat.create_message(session, sender, %{body: "hands off"})

      assert {:error, :not_authorized} = remove_message(message, sender)
      assert {:error, :not_authorized} = remove_message(message, outsider)

      persisted_message = Repo.get!(ChatMessage, message.id)
      assert Map.get(persisted_message, :status, :active) == :active
      assert Map.get(persisted_message, :moderated_at) == nil
      assert Map.get(persisted_message, :moderated_by_id) == nil
    end

    test "keeps one moderation timestamp when concurrent host removals race" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(session, viewer, %{body: "race condition"})

      removal_tasks =
        Enum.map(1..2, fn _attempt ->
          Task.async(fn -> remove_message(message, host) end)
        end)

      Enum.each(removal_tasks, &allow_chat_db(&1.pid))

      results = Enum.map(removal_tasks, &Task.await(&1, 5_000))
      assert Enum.all?(results, &match?({:ok, %ChatMessage{}}, &1))

      moderated_at_values =
        results
        |> Enum.map(fn {:ok, removed_message} -> Map.get(removed_message, :moderated_at) end)
        |> Enum.uniq()

      assert length(moderated_at_values) == 1

      persisted_message = Repo.get!(ChatMessage, message.id)

      assert persisted_message.moderated_at in moderated_at_values
      assert persisted_message.moderated_by_id == host.id
    end

    test "returns one removal transition winner when concurrent host removals race" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, message} = Chat.create_message(session, viewer, %{body: "transition race"})

      removal_tasks =
        Enum.map(1..2, fn _attempt ->
          Task.async(fn -> remove_message_with_transition(message, host) end)
        end)

      Enum.each(removal_tasks, &allow_chat_db(&1.pid))

      results = Enum.map(removal_tasks, &Task.await(&1, 5_000))
      assert Enum.count(results, &match?({:ok, %ChatMessage{}, true}, &1)) == 1
      assert Enum.count(results, &match?({:ok, %ChatMessage{}, false}, &1)) == 1
    end
  end

  defp remove_message(chat_message, actor) do
    if Code.ensure_loaded?(Chat) and function_exported?(Chat, :remove_message, 2) do
      apply(Chat, :remove_message, [chat_message, actor])
    else
      :missing_remove_message
    end
  end

  defp remove_message_with_transition(chat_message, actor) do
    if Code.ensure_loaded?(Chat) and function_exported?(Chat, :remove_message_with_transition, 2) do
      apply(Chat, :remove_message_with_transition, [chat_message, actor])
    else
      :missing_remove_message_with_transition
    end
  end

  defp record_system_event(live_session, event_type, opts) do
    if Code.ensure_loaded?(Chat) and function_exported?(Chat, :record_system_event, 3) do
      apply(Chat, :record_system_event, [live_session, event_type, opts])
    else
      :missing_record_system_event
    end
  end

  defp allow_chat_db(pid) when is_pid(pid) do
    case Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid) do
      :ok -> :ok
      {:already, _owner} -> :ok
      :not_found -> :ok
    end
  end
end
