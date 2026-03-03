defmodule LC.FeedTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Content, Feed, Live, Social}

  describe "home_feed/2" do
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

  describe "live_now/2" do
    test "excludes hosts muted by the viewer" do
      viewer = user_fixture()
      muted_host = user_fixture(privacy_mode: :public)
      _mute = mute_fixture(viewer, muted_host)

      {:ok, muted_session} = Live.start_live_session(muted_host, %{visibility: :public})
      {:ok, _muted_live} = Live.mark_session_live(muted_session)

      assert [] = Feed.live_now(viewer, limit: 10)
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
end
