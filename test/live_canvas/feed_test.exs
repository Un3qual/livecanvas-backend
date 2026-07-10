defmodule LC.FeedTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.ContentFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Content, Feed, Live, ReadPolicy, Social}
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post
  alias LCSchemas.Live.LiveSession, as: LiveSessionSchema

  describe "home_feed/2" do
    test "excludes visible story posts" do
      viewer = user_fixture()
      creator = user_fixture(privacy_mode: :public)

      {:ok, _story_post} =
        Content.create_post(creator, %{kind: :story, body_text: "story", visibility: :public})

      {:ok, standard_post} =
        Content.create_post(creator, %{
          kind: :standard,
          body_text: "timeline",
          visibility: :public
        })

      assert [visible_post] = Feed.home_feed(viewer, limit: 10)
      assert visible_post.id == standard_post.id
    end

    test "excludes suspended creators" do
      viewer = user_fixture()
      suspended_creator = user_fixture(privacy_mode: :public)
      assert {:ok, _suspended_creator} = Accounts.suspend_user(suspended_creator)

      {:ok, _post} =
        Content.create_post(suspended_creator, %{
          kind: :standard,
          body_text: "suspended",
          visibility: :public
        })

      assert [] = Feed.home_feed(viewer, limit: 10)
    end

    test "excludes blocked creators" do
      viewer = user_fixture()
      creator = user_fixture(privacy_mode: :public)

      {:ok, _post} =
        Content.create_post(creator, %{kind: :standard, body_text: "blocked", visibility: :public})

      {:ok, _block} = Social.block_user(creator, viewer)

      assert [] = Feed.home_feed(viewer, limit: 10)
    end

    test "excludes creators muted by the viewer" do
      viewer = user_fixture()
      muted_creator = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(viewer, muted_creator)

      {:ok, _post} =
        Content.create_post(muted_creator, %{
          kind: :standard,
          body_text: "muted",
          visibility: :public
        })

      assert [] = Feed.home_feed(viewer, limit: 10)
    end

    test "does not exclude creators who muted the viewer" do
      viewer = user_fixture()
      creator = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(creator, viewer)

      {:ok, post} =
        Content.create_post(creator, %{
          kind: :standard,
          body_text: "reverse-mute",
          visibility: :public
        })

      assert [visible_post] = Feed.home_feed(viewer, limit: 10)
      assert visible_post.id == post.id
    end

    test "returns visible posts ordered newest-first" do
      viewer = user_fixture()
      followed_creator = user_fixture()
      public_creator = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, followed_creator)

      {:ok, followed_post} =
        Content.create_post(followed_creator, %{kind: :standard, body_text: "followers-visible"})

      {:ok, public_post} =
        Content.create_post(public_creator, %{
          kind: :standard,
          body_text: "public",
          visibility: :public
        })

      assert [first_post, second_post] = Feed.home_feed(viewer, limit: 10)
      assert first_post.id == public_post.id
      assert second_post.id == followed_post.id
    end
  end

  describe "story_feed/2" do
    test "returns active visible stories ordered newest-first" do
      viewer = user_fixture()
      followed_creator = user_fixture()
      public_creator = user_fixture(privacy_mode: :public)
      blocked_creator = user_fixture(privacy_mode: :public)
      muted_creator = user_fixture(privacy_mode: :public)

      _follow = accepted_follow_fixture(viewer, followed_creator)
      {:ok, _block} = Social.block_user(blocked_creator, viewer)
      _mute = mute_fixture(viewer, muted_creator)

      {:ok, followed_story} =
        Content.create_post(followed_creator, %{kind: :story, body_text: "followers story"})

      {:ok, public_story} =
        Content.create_post(public_creator, %{
          kind: :story,
          body_text: "public story",
          visibility: :public
        })

      {:ok, _expired_story} =
        Content.create_post(public_creator, %{
          kind: :story,
          body_text: "expired story",
          visibility: :public
        })

      {:ok, _standard_post} =
        Content.create_post(public_creator, %{
          kind: :standard,
          body_text: "standard post",
          visibility: :public
        })

      {:ok, _blocked_story} =
        Content.create_post(blocked_creator, %{
          kind: :story,
          body_text: "blocked story",
          visibility: :public
        })

      {:ok, _muted_story} =
        Content.create_post(muted_creator, %{
          kind: :story,
          body_text: "muted story",
          visibility: :public
        })

      now = DateTime.utc_now()
      followed_inserted_at = DateTime.add(now, -180, :second)
      public_inserted_at = DateTime.add(now, -120, :second)
      expired_inserted_at = DateTime.add(now, -60, :second)
      active_expires_at = DateTime.add(now, 60, :second)
      expired_expires_at = DateTime.add(now, -60, :second)

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^followed_story.id),
          set: [
            inserted_at: followed_inserted_at,
            updated_at: followed_inserted_at,
            expires_at: active_expires_at
          ]
        )

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^public_story.id),
          set: [
            inserted_at: public_inserted_at,
            updated_at: public_inserted_at,
            expires_at: active_expires_at
          ]
        )

      {1, _rows} =
        Repo.update_all(
          from(post in Post, where: post.body_text == "expired story"),
          set: [
            inserted_at: expired_inserted_at,
            updated_at: expired_inserted_at,
            expires_at: expired_expires_at
          ]
        )

      assert [first_story, second_story] = Feed.story_feed(viewer, limit: 10)
      assert first_story.id == public_story.id
      assert second_story.id == followed_story.id
    end
  end

  describe "profile_posts/3" do
    test "returns only visible standard posts authored by the requested profile owner ordered newest-first" do
      viewer = user_fixture()
      profile_owner = user_fixture()
      other_owner = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, profile_owner)

      {:ok, older_post} =
        Content.create_post(profile_owner, %{kind: :standard, body_text: "older profile post"})

      {:ok, newer_post} =
        Content.create_post(profile_owner, %{kind: :standard, body_text: "newer profile post"})

      {:ok, _profile_story} =
        Content.create_post(profile_owner, %{kind: :story, body_text: "profile story"})

      {:ok, _other_owner_post} =
        Content.create_post(other_owner, %{
          kind: :standard,
          body_text: "other owner post",
          visibility: :public
        })

      older_inserted_at = ~U[2026-03-18 18:00:00Z]
      newer_inserted_at = ~U[2026-03-18 19:00:00Z]

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^older_post.id),
          set: [inserted_at: older_inserted_at, updated_at: older_inserted_at]
        )

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^newer_post.id),
          set: [inserted_at: newer_inserted_at, updated_at: newer_inserted_at]
        )

      assert [first_post, second_post] = invoke_profile_posts(viewer, profile_owner, limit: 10)
      assert first_post.id == newer_post.id
      assert second_post.id == older_post.id
    end

    test "returns no posts when the profile owner is not visible to the viewer" do
      viewer = user_fixture()
      private_owner = user_fixture()
      blocked_owner = user_fixture(privacy_mode: :public)
      muted_owner = user_fixture(privacy_mode: :public)
      suspended_owner = user_fixture(privacy_mode: :public)

      {:ok, _private_post} =
        Content.create_post(private_owner, %{kind: :standard, body_text: "private profile post"})

      {:ok, _blocked_post} =
        Content.create_post(blocked_owner, %{
          kind: :standard,
          body_text: "blocked profile post",
          visibility: :public
        })

      {:ok, _muted_post} =
        Content.create_post(muted_owner, %{
          kind: :standard,
          body_text: "muted profile post",
          visibility: :public
        })

      {:ok, _suspended_post} =
        Content.create_post(suspended_owner, %{
          kind: :standard,
          body_text: "suspended profile post",
          visibility: :public
        })

      {:ok, _block} = Social.block_user(blocked_owner, viewer)
      _mute = mute_fixture(viewer, muted_owner)
      assert {:ok, _suspended_owner} = Accounts.suspend_user(suspended_owner)

      assert [] = invoke_profile_posts(viewer, private_owner, limit: 10)
      assert [] = invoke_profile_posts(viewer, blocked_owner, limit: 10)
      assert [] = invoke_profile_posts(viewer, muted_owner, limit: 10)
      assert [] = invoke_profile_posts(viewer, suspended_owner, limit: 10)
    end

    test "returns no posts for an unsaved profile owner instead of the viewer feed" do
      viewer = user_fixture()
      public_owner = user_fixture(privacy_mode: :public)

      {:ok, _public_post} =
        Content.create_post(public_owner, %{
          kind: :standard,
          body_text: "visible public post",
          visibility: :public
        })

      assert [] = invoke_profile_posts(viewer, %User{}, limit: 10)
    end
  end

  describe "profile_story_feed/3" do
    test "returns only active visible stories authored by the requested profile owner ordered newest-first" do
      viewer = user_fixture()
      profile_owner = user_fixture()
      other_owner = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, profile_owner)

      {:ok, older_story} =
        Content.create_post(profile_owner, %{kind: :story, body_text: "older profile story"})

      {:ok, newer_story} =
        Content.create_post(profile_owner, %{kind: :story, body_text: "newer profile story"})

      {:ok, _expired_story} =
        Content.create_post(profile_owner, %{kind: :story, body_text: "expired profile story"})

      {:ok, _standard_post} =
        Content.create_post(profile_owner, %{kind: :standard, body_text: "standard post"})

      {:ok, _other_owner_story} =
        Content.create_post(other_owner, %{
          kind: :story,
          body_text: "other owner story",
          visibility: :public
        })

      now = DateTime.utc_now()
      older_inserted_at = ~U[2026-03-18 18:00:00Z]
      newer_inserted_at = ~U[2026-03-18 19:00:00Z]
      active_expires_at = DateTime.add(now, 60, :second)
      expired_expires_at = DateTime.add(now, -60, :second)

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^older_story.id),
          set: [
            inserted_at: older_inserted_at,
            updated_at: older_inserted_at,
            expires_at: active_expires_at
          ]
        )

      {1, _rows} =
        Repo.update_all(from(post in Post, where: post.id == ^newer_story.id),
          set: [
            inserted_at: newer_inserted_at,
            updated_at: newer_inserted_at,
            expires_at: active_expires_at
          ]
        )

      {1, _rows} =
        Repo.update_all(
          from(post in Post, where: post.body_text == "expired profile story"),
          set: [expires_at: expired_expires_at]
        )

      assert [first_story, second_story] =
               invoke_profile_story_feed(viewer, profile_owner, limit: 10)

      assert first_story.id == newer_story.id
      assert second_story.id == older_story.id
    end

    test "returns no stories when the profile owner is blocked from the viewer" do
      viewer = user_fixture()
      blocked_owner = user_fixture(privacy_mode: :public)

      {:ok, _story} =
        Content.create_post(blocked_owner, %{
          kind: :story,
          body_text: "blocked profile story",
          visibility: :public
        })

      {:ok, _block} = Social.block_user(blocked_owner, viewer)

      assert [] = invoke_profile_story_feed(viewer, blocked_owner, limit: 10)
    end

    test "returns no stories for an unsaved profile owner instead of the viewer feed" do
      viewer = user_fixture()
      public_owner = user_fixture(privacy_mode: :public)

      {:ok, _public_story} =
        Content.create_post(public_owner, %{
          kind: :story,
          body_text: "visible public story",
          visibility: :public,
          expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
        })

      assert [] = invoke_profile_story_feed(viewer, %User{}, limit: 10)
    end
  end

  describe "visible_posts_query/2" do
    test "applies the home feed visibility matrix to post queries" do
      viewer = user_fixture()
      followed_creator = user_fixture()
      public_creator = user_fixture(privacy_mode: :public)
      blocked_creator = user_fixture(privacy_mode: :public)
      muted_creator = user_fixture(privacy_mode: :public)
      reverse_muter = user_fixture(privacy_mode: :public)

      _follow = accepted_follow_fixture(viewer, followed_creator)
      {:ok, _block} = Social.block_user(blocked_creator, viewer)
      _mute = mute_fixture(viewer, muted_creator)
      _reverse_mute = mute_fixture(reverse_muter, viewer)

      {:ok, followed_post} =
        Content.create_post(followed_creator, %{kind: :standard, body_text: "followers-visible"})

      {:ok, public_post} =
        Content.create_post(public_creator, %{
          kind: :standard,
          body_text: "public-visible",
          visibility: :public
        })

      {:ok, _blocked_post} =
        Content.create_post(blocked_creator, %{
          kind: :standard,
          body_text: "blocked-hidden",
          visibility: :public
        })

      {:ok, _muted_post} =
        Content.create_post(muted_creator, %{
          kind: :standard,
          body_text: "muted-hidden",
          visibility: :public
        })

      {:ok, reverse_muted_post} =
        Content.create_post(reverse_muter, %{
          kind: :standard,
          body_text: "reverse-mute-visible",
          visibility: :public
        })

      assert Code.ensure_loaded?(ReadPolicy)

      helper_post_ids =
        Post
        |> ReadPolicy.visible_posts_query(viewer)
        |> order_by([post], desc: post.inserted_at, desc: post.id)
        |> Repo.all()
        |> Enum.map(& &1.id)

      assert helper_post_ids == [reverse_muted_post.id, public_post.id, followed_post.id]
      assert helper_post_ids == Feed.home_feed(viewer, limit: 10) |> Enum.map(& &1.id)
    end
  end

  describe "live_now/2" do
    test "excludes suspended hosts" do
      viewer = user_fixture()
      suspended_host = user_fixture(privacy_mode: :public)

      {:ok, suspended_session} = Live.start_live_session(suspended_host, %{visibility: :public})
      {:ok, _suspended_live} = Live.mark_session_live(suspended_session)
      assert {:ok, _suspended_host} = Accounts.suspend_user(suspended_host)

      assert [] = Feed.live_now(viewer, limit: 10)
    end

    test "excludes hosts muted by the viewer" do
      viewer = user_fixture()
      muted_host = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(viewer, muted_host)

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})
      {:ok, _muted_live} = Live.mark_session_live(muted_session)

      assert [] = Feed.live_now(viewer, limit: 10)
    end

    test "does not exclude hosts who muted the viewer" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(host, viewer)

      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _live_session} = Live.mark_session_live(live_session)

      assert [visible_session] = Feed.live_now(viewer, limit: 10)
      assert visible_session.id == live_session.id
    end

    test "returns fresh preflight sessions before visible live sessions" do
      viewer = user_fixture()
      followed_host = user_fixture()
      public_host = user_fixture(privacy_mode: :public)
      blocked_host = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, followed_host)
      {:ok, _block} = Social.block_user(blocked_host, viewer)

      {:ok, followed_session} = Live.start_live_session(followed_host, %{visibility: :followers})
      {:ok, _followed_live} = Live.mark_session_live(followed_session)

      {:ok, public_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, _public_live} = Live.mark_session_live(public_session)

      {:ok, blocked_session} = Live.start_live_session(blocked_host, %{visibility: :public})
      {:ok, _blocked_live} = Live.mark_session_live(blocked_session)

      {:ok, starting_session} = Live.start_live_session(public_host, %{visibility: :public})

      assert [first_session, second_session, third_session] = Feed.live_now(viewer, limit: 10)
      assert first_session.id == starting_session.id
      assert second_session.id == public_session.id
      assert third_session.id == followed_session.id
      assert [first_limited_session] = Feed.live_now(viewer, limit: 1)
      assert first_limited_session.id == starting_session.id
    end

    test "excludes stale preflight sessions from discovery" do
      viewer = user_fixture()
      public_host = user_fixture(privacy_mode: :public)

      {:ok, stale_starting_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, fresh_starting_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, live_session} = Live.start_live_session(public_host, %{visibility: :public})
      {:ok, _live_session} = Live.mark_session_live(live_session)

      stale_inserted_at = DateTime.utc_now() |> DateTime.add(-11 * 60, :second)

      {1, _rows} =
        Repo.update_all(
          from(live_session in LiveSessionSchema,
            where: live_session.id == ^stale_starting_session.id
          ),
          set: [inserted_at: stale_inserted_at, updated_at: stale_inserted_at]
        )

      visible_session_ids =
        viewer
        |> Feed.live_now(limit: 10)
        |> Enum.map(& &1.id)

      assert visible_session_ids == [fresh_starting_session.id, live_session.id]
      refute stale_starting_session.id in visible_session_ids
    end
  end

  describe "profile_current_live_session/2" do
    test "returns the requested host's visible live session and nil otherwise" do
      viewer = user_fixture()
      visible_host = user_fixture()
      other_host = user_fixture(privacy_mode: :public)
      private_host = user_fixture()
      muted_host = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, visible_host)

      {:ok, visible_session} = Live.start_live_session(visible_host, %{visibility: :followers})
      {:ok, visible_session} = Live.mark_session_live(visible_session)

      {:ok, other_session} = Live.start_live_session(other_host, %{visibility: :public})
      {:ok, other_session} = Live.mark_session_live(other_session)

      {:ok, private_session} = Live.start_live_session(private_host, %{visibility: :followers})
      {:ok, _private_session} = Live.mark_session_live(private_session)

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})
      {:ok, _muted_session} = Live.mark_session_live(muted_session)

      _mute = mute_fixture(viewer, muted_host)

      assert %{id: session_id} =
               Feed.profile_current_live_session_query(viewer, visible_host) |> Repo.one()

      assert session_id == visible_session.id

      assert %{id: other_session_id} =
               Feed.profile_current_live_session_query(viewer, other_host) |> Repo.one()

      assert other_session_id == other_session.id
      assert nil == Feed.profile_current_live_session_query(viewer, private_host) |> Repo.one()
      assert nil == Feed.profile_current_live_session_query(viewer, muted_host) |> Repo.one()
    end

    test "returns a visible starting session before go-live media negotiation completes" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)
      {:ok, starting_session} = Live.start_live_session(host, %{visibility: :public})

      assert %{id: session_id, status: :starting} =
               Feed.profile_current_live_session_query(viewer, host) |> Repo.one()

      assert session_id == starting_session.id
    end

    test "prefers a visible live session over a fresh duplicate preflight for a profile" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)

      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(live_session)
      {:ok, _starting_session} = Live.start_live_session(host, %{visibility: :public})

      assert %{id: session_id, status: :live} = Feed.profile_current_live_session(viewer, host)

      assert session_id == live_session.id
    end

    test "does not return stale starting sessions for a profile" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)
      {:ok, starting_session} = Live.start_live_session(host, %{visibility: :public})

      stale_inserted_at = DateTime.utc_now() |> DateTime.add(-11 * 60, :second)

      {1, _rows} =
        Repo.update_all(
          from(live_session in LiveSessionSchema, where: live_session.id == ^starting_session.id),
          set: [inserted_at: stale_inserted_at, updated_at: stale_inserted_at]
        )

      assert nil == Feed.profile_current_live_session_query(viewer, host) |> Repo.one()
    end
  end

  describe "replay_feed/2" do
    test "returns visible replay sessions ordered newest-first" do
      viewer = user_fixture()
      followed_host = user_fixture()
      public_host = user_fixture()
      _follow = accepted_follow_fixture(viewer, followed_host)

      followed_replay =
        ended_replay_session_fixture(followed_host, %{
          visibility: :followers,
          ended_at: ~U[2026-03-18 18:00:00Z]
        })

      public_replay =
        ended_replay_session_fixture(public_host, %{
          visibility: :public,
          ended_at: ~U[2026-03-18 19:00:00Z]
        })

      assert [first_session, second_session] = Feed.replay_feed(viewer, limit: 10)
      assert first_session.id == public_replay.id
      assert second_session.id == followed_replay.id
    end

    test "excludes ended sessions without linked recordings" do
      viewer = user_fixture()
      public_host = user_fixture()

      replay_session = ended_replay_session_fixture(public_host, %{visibility: :public})

      _unrecorded_session =
        ended_replay_session_fixture(public_host, %{visibility: :public, with_recording: false})

      assert [visible_session] = Feed.replay_feed(viewer, limit: 10)
      assert visible_session.id == replay_session.id
    end

    test "excludes unauthorized replay sessions while preserving host self-visibility" do
      viewer = user_fixture()
      blocked_host = user_fixture()
      muted_host = user_fixture()
      suspended_host = user_fixture()
      follower_only_host = user_fixture()

      own_replay = ended_replay_session_fixture(viewer, %{visibility: :followers})
      _blocked_replay = ended_replay_session_fixture(blocked_host, %{visibility: :public})
      _muted_replay = ended_replay_session_fixture(muted_host, %{visibility: :public})
      _suspended_replay = ended_replay_session_fixture(suspended_host, %{visibility: :public})

      _follower_only_replay =
        ended_replay_session_fixture(follower_only_host, %{visibility: :followers})

      {:ok, _block} = Social.block_user(blocked_host, viewer)
      _mute = mute_fixture(viewer, muted_host)
      assert {:ok, _suspended_host} = Accounts.suspend_user(suspended_host)

      assert [visible_session] = Feed.replay_feed(viewer, limit: 10)
      assert visible_session.id == own_replay.id
    end

    test "does not exclude replay sessions from hosts who muted the viewer" do
      viewer = user_fixture()
      host = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(host, viewer)

      replay_session = ended_replay_session_fixture(host, %{visibility: :public})

      assert [visible_session] = Feed.replay_feed(viewer, limit: 10)
      assert visible_session.id == replay_session.id
    end
  end

  describe "profile_replay_feed/3" do
    test "returns only visible replay sessions for the requested host ordered newest-first" do
      viewer = user_fixture()
      profile_host = user_fixture()
      other_host = user_fixture(privacy_mode: :public)
      _follow = accepted_follow_fixture(viewer, profile_host)

      older_replay =
        ended_replay_session_fixture(profile_host, %{
          visibility: :followers,
          ended_at: ~U[2026-03-18 18:00:00Z]
        })

      newer_replay =
        ended_replay_session_fixture(profile_host, %{
          visibility: :followers,
          ended_at: ~U[2026-03-18 19:00:00Z]
        })

      _other_host_replay =
        ended_replay_session_fixture(other_host, %{
          visibility: :public,
          ended_at: ~U[2026-03-18 20:00:00Z]
        })

      assert [first_session, second_session] =
               Feed.profile_replay_feed_query(viewer, profile_host)
               |> limit(10)
               |> Repo.all()

      assert first_session.id == newer_replay.id
      assert second_session.id == older_replay.id
    end

    test "returns no replay sessions when the requested host is blocked, muted, suspended, or private without follow" do
      viewer = user_fixture()
      private_host = user_fixture()
      blocked_host = user_fixture(privacy_mode: :public)
      muted_host = user_fixture(privacy_mode: :public)
      suspended_host = user_fixture(privacy_mode: :public)

      _private_replay = ended_replay_session_fixture(private_host, %{visibility: :followers})
      _blocked_replay = ended_replay_session_fixture(blocked_host, %{visibility: :public})
      _muted_replay = ended_replay_session_fixture(muted_host, %{visibility: :public})
      _suspended_replay = ended_replay_session_fixture(suspended_host, %{visibility: :public})

      {:ok, _block} = Social.block_user(blocked_host, viewer)
      _mute = mute_fixture(viewer, muted_host)
      assert {:ok, _suspended_host} = Accounts.suspend_user(suspended_host)

      assert [] = Feed.profile_replay_feed_query(viewer, private_host) |> limit(10) |> Repo.all()
      assert [] = Feed.profile_replay_feed_query(viewer, blocked_host) |> limit(10) |> Repo.all()
      assert [] = Feed.profile_replay_feed_query(viewer, muted_host) |> limit(10) |> Repo.all()

      assert [] =
               Feed.profile_replay_feed_query(viewer, suspended_host) |> limit(10) |> Repo.all()
    end
  end

  defp ended_replay_session_fixture(host, attrs) when is_map(attrs) do
    visibility = Map.get(attrs, :visibility, :public)
    ended_at = Map.get(attrs, :ended_at)
    with_recording? = Map.get(attrs, :with_recording, true)

    {:ok, session} = Live.start_live_session(host, %{visibility: visibility})

    end_attrs =
      if with_recording? do
        recording_asset =
          media_asset_fixture(host, %{
            mime_type: "video/mp4",
            processing_state: :uploaded,
            storage_key:
              "uploads/users/#{host.id}/replay-#{System.unique_integer([:positive])}.mp4"
          })

        %{ended_reason: :host_ended, recording_media_asset_id: recording_asset.id}
      else
        %{ended_reason: :host_ended}
      end

    {:ok, ended_session} = Live.end_live_session(session, end_attrs)
    maybe_reset_ended_at(ended_session, ended_at)
  end

  defp maybe_reset_ended_at(ended_session, nil), do: ended_session

  defp maybe_reset_ended_at(%{id: session_id}, %DateTime{} = ended_at) do
    from(session in LiveSessionSchema, where: session.id == ^session_id)
    |> Repo.update_all(set: [ended_at: ended_at])

    Live.get_live_session!(session_id)
  end

  defp invoke_profile_posts(viewer, owner, opts) do
    invoke_feed(:profile_posts, [viewer, owner, opts], [])
  end

  defp invoke_profile_story_feed(viewer, owner, opts) do
    invoke_feed(:profile_story_feed, [viewer, owner, opts], [])
  end

  defp invoke_feed(function_name, args, missing_value) do
    arity = length(args)

    if function_exported?(Feed, function_name, arity) do
      apply(Feed, function_name, args)
    else
      missing_value
    end
  end
end
