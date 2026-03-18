defmodule LC.FeedTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.ContentFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Content, Feed, Live, ReadPolicy, Social}
  alias LCSchemas.Content.Post
  alias LCSchemas.Live.LiveSession, as: LiveSessionSchema

  describe "home_feed/2" do
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

  describe "viewer_visible_query/3" do
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
        |> ReadPolicy.viewer_visible_query(viewer,
          owner_key: :author_id,
          visibility_key: :visibility
        )
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

    test "returns only visible live sessions ordered newest-first" do
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

      {:ok, _starting_session} = Live.start_live_session(public_host, %{visibility: :public})

      assert [first_session, second_session] = Feed.live_now(viewer, limit: 10)
      assert first_session.id == public_session.id
      assert second_session.id == followed_session.id
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
end
