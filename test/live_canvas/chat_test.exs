defmodule LC.ChatTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Live, ReadPolicy}

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

    test "allows join for public sessions when a pending follow request is still present" do
      host = user_fixture()
      viewer = user_fixture()

      assert {:ok, _follow} = LC.Social.follow_user(viewer, host)
      assert {:ok, public_host} = Accounts.update_user_privacy_mode(host, :public)
      {:ok, session} = Live.start_live_session(public_host, %{visibility: :public})

      assert :ok = Chat.authorize_join(viewer, session)
    end
  end

  describe "authorize_history_access/2" do
    test "allows history reads for authorized viewers on live and ended sessions" do
      host = user_fixture()
      follower = user_fixture()
      _follow = accepted_follow_fixture(follower, host)
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, live_event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "live"})

      assert :ok = Chat.authorize_history_access(host, live_session)
      assert :ok = Chat.authorize_history_access(follower, live_session)
      assert [%{id: live_event_id}] = Repo.all(Chat.timeline_history_query(live_session))
      assert live_event_id == live_event.id

      {:ok, ended_session} = Live.end_live_session(live_session)

      assert :ok = Chat.authorize_history_access(host, ended_session)
      assert :ok = Chat.authorize_history_access(follower, ended_session)
      assert [%{id: ended_event_id}] = Repo.all(Chat.timeline_history_query(ended_session))
      assert ended_event_id == live_event.id
    end

    test "allows public-session history reads for active viewers after the session ends" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, public_event} =
               Chat.create_timeline_chat_message(live_session, host, %{body: "public"})

      assert :ok = Chat.authorize_history_access(viewer, live_session)
      assert [%{id: public_event_id}] = Repo.all(Chat.timeline_history_query(live_session))
      assert public_event_id == public_event.id

      {:ok, ended_session} = Live.end_live_session(live_session)

      assert :ok = Chat.authorize_history_access(viewer, ended_session)
      assert [%{id: ended_event_id}] = Repo.all(Chat.timeline_history_query(ended_session))
      assert ended_event_id == public_event.id
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
end
