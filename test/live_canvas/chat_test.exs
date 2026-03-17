defmodule LC.ChatTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures
  import Ecto.Query

  alias LC.{Accounts, Chat, Live}
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
end
