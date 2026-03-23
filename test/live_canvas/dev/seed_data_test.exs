defmodule LC.Dev.SeedDataTest do
  use LC.DataCase, async: true

  alias LC.{Accounts, Content, Feed, Social}
  alias LC.Dev.SeedData
  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession
  alias LCSchemas.Social.Follow

  import Ecto.Query

  @seeded_accounts [
    %{email: "dev-viewer@example.com", privacy_mode: :private},
    %{email: "dev-creator@example.com", privacy_mode: :public},
    %{email: "dev-host@example.com", privacy_mode: :public}
  ]

  @seeded_home_feed_posts [
    "Host is warming up the camera rig for the seeded live session.",
    "Followers-only lighting notes from the seeded creator account.",
    "Public studio check-in from the seeded creator account."
  ]

  @shared_password "dev-password-123"

  test "seed!/0 creates the stable seeded users with shared credentials" do
    summary = SeedData.seed!()

    assert summary.shared_password == @shared_password
    assert Enum.map(summary.users, & &1.email) == Enum.map(@seeded_accounts, & &1.email)
    assert length(seeded_user_ids()) == length(@seeded_accounts)

    Enum.each(@seeded_accounts, fn %{email: email, privacy_mode: privacy_mode} ->
      assert %User{id: user_id, privacy_mode: ^privacy_mode} = Accounts.get_user_by_email(email)

      assert %User{id: ^user_id} =
               Accounts.get_user_by_email_and_password(email, @shared_password)
    end)
  end

  test "seed!/0 gives the primary viewer following, home feed, and live discovery data" do
    SeedData.seed!()

    assert %User{} = viewer = Accounts.get_user_by_email("dev-viewer@example.com")
    assert %User{} = creator = Accounts.get_user_by_email("dev-creator@example.com")
    assert %User{} = host = Accounts.get_user_by_email("dev-host@example.com")

    assert [creator.id, host.id] ==
             viewer
             |> Social.following_users_query()
             |> Repo.all()
             |> Enum.map(& &1.id)

    assert @seeded_home_feed_posts ==
             viewer
             |> Feed.home_feed()
             |> Enum.map(& &1.body_text)

    assert [%{host_id: host_id, status: :live, visibility: :followers}] = Feed.live_now(viewer)
    assert host_id == host.id
  end

  test "seed!/0 reuses seeded users instead of duplicating them and restores seed state" do
    SeedData.seed!()

    assert %User{} = viewer = Accounts.get_user_by_email("dev-viewer@example.com")
    assert %User{} = creator = Accounts.get_user_by_email("dev-creator@example.com")
    assert %User{} = host = Accounts.get_user_by_email("dev-host@example.com")

    {:ok, {creator, _expired_tokens}} =
      Accounts.update_user_password(creator, %{password: "another-password-123"})

    {:ok, _creator} = Accounts.update_user_privacy_mode(creator, :private)

    first_follow_ids = seeded_follow_ids(viewer, creator, host)
    first_post_ids = seeded_post_ids(creator, host)
    first_live_session_ids = seeded_live_session_ids(host)

    assert [followers_only_post] =
             viewer
             |> Feed.profile_posts(creator)
             |> Enum.filter(&(&1.visibility == :followers))

    {:ok, _updated_post} =
      Content.update_user_post(creator, followers_only_post.id, %{visibility: :public})

    assert [%LiveSession{} = live_session] = Feed.live_now(viewer)

    {:ok, _updated_live_session} =
      live_session
      |> change(%{visibility: :public})
      |> Repo.update()

    first_ids = seeded_user_ids()

    summary = SeedData.seed!()

    assert summary.shared_password == @shared_password
    assert seeded_user_ids() == first_ids
    assert seeded_follow_ids(viewer, creator, host) == first_follow_ids
    assert seeded_post_ids(creator, host) == first_post_ids
    assert seeded_live_session_ids(host) == first_live_session_ids
    assert length(seeded_user_ids()) == length(@seeded_accounts)
    assert %User{privacy_mode: :public} = Accounts.get_user_by_email("dev-creator@example.com")

    assert %User{} =
             Accounts.get_user_by_email_and_password("dev-creator@example.com", @shared_password)

    assert @seeded_home_feed_posts ==
             viewer
             |> Feed.home_feed()
             |> Enum.map(& &1.body_text)

    assert [%{host_id: host_id, status: :live, visibility: :followers}] = Feed.live_now(viewer)
    assert host_id == host.id
  end

  defp seeded_user_ids do
    from(user in User,
      join: user_email in assoc(user, :user_email_addresses),
      join: email_address in assoc(user_email, :email_address),
      where: email_address.normalized_email in ^Enum.map(@seeded_accounts, & &1.email),
      order_by: [asc: email_address.normalized_email],
      select: user.id
    )
    |> Repo.all()
  end

  defp seeded_follow_ids(%User{id: viewer_id}, %User{id: creator_id}, %User{id: host_id}) do
    from(follow in Follow,
      where:
        follow.follower_id == ^viewer_id and follow.followed_id in ^[creator_id, host_id] and
          follow.state == :accepted,
      order_by: [asc: follow.followed_id],
      select: follow.id
    )
    |> Repo.all()
  end

  defp seeded_post_ids(%User{id: creator_id}, %User{id: host_id}) do
    from(post in LCSchemas.Content.Post,
      where:
        post.author_id in ^[creator_id, host_id] and post.body_text in ^@seeded_home_feed_posts,
      order_by: [asc: post.body_text],
      select: post.id
    )
    |> Repo.all()
  end

  defp seeded_live_session_ids(%User{id: host_id}) do
    from(live_session in LiveSession,
      where: live_session.host_id == ^host_id and live_session.status == :live,
      order_by: [asc: live_session.id],
      select: live_session.id
    )
    |> Repo.all()
  end
end
