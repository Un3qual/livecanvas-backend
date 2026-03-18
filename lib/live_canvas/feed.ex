defmodule LC.Feed do
  @moduledoc """
  Read-side feed composition across content, social, and live data.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  import Ecto.Query, warn: false

  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post
  alias LCSchemas.Live.LiveSession
  alias LCSchemas.Social.{Block, Follow, Mute}

  @default_limit 25

  @type home_feed_opts :: [limit: pos_integer()]
  @type live_now_opts :: [limit: pos_integer()]
  @type replay_feed_opts :: [limit: pos_integer()]

  @doc """
  Returns the viewer's visible home feed ordered newest-first.
  """
  @spec home_feed(User.t(), home_feed_opts()) :: [Post.t()]
  def home_feed(%User{} = viewer, opts \\ []) do
    viewer
    |> home_feed_query()
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns a deterministic query for the viewer's visible home feed.
  """
  @spec home_feed_query(User.t()) :: Ecto.Query.t()
  def home_feed_query(%User{id: viewer_id}) when is_integer(viewer_id) do
    from(post in Post,
      join: author in User,
      on: author.id == post.author_id,
      left_join: follow in Follow,
      on:
        follow.follower_id == ^viewer_id and
          follow.followed_id == post.author_id and
          follow.state == :accepted,
      left_join: mute in Mute,
      on: mute.muter_id == ^viewer_id and mute.muted_id == post.author_id,
      left_join: block in Block,
      on:
        (block.blocker_id == ^viewer_id and block.blocked_id == post.author_id) or
          (block.blocker_id == post.author_id and block.blocked_id == ^viewer_id),
      where: is_nil(author.suspended_at),
      where: is_nil(block.id),
      # Mute checks are directional: only the viewer muting the author
      # suppresses feed visibility.
      where: is_nil(mute.id),
      where: post.author_id == ^viewer_id or post.visibility == :public or not is_nil(follow.id),
      order_by: [desc: post.inserted_at, desc: post.id]
    )
  end

  @doc """
  Returns currently-live sessions visible to the viewer, newest-first.
  """
  @spec live_now(User.t(), live_now_opts()) :: [LiveSession.t()]
  def live_now(%User{} = viewer, opts \\ []) do
    viewer
    |> live_now_query()
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns a deterministic query for currently-live sessions visible to the viewer.
  """
  @spec live_now_query(User.t()) :: Ecto.Query.t()
  def live_now_query(%User{id: viewer_id}) when is_integer(viewer_id) do
    from(live_session in LiveSession,
      join: host in User,
      on: host.id == live_session.host_id,
      left_join: follow in Follow,
      on:
        follow.follower_id == ^viewer_id and
          follow.followed_id == live_session.host_id and
          follow.state == :accepted,
      left_join: mute in Mute,
      on: mute.muter_id == ^viewer_id and mute.muted_id == live_session.host_id,
      left_join: block in Block,
      on:
        (block.blocker_id == ^viewer_id and block.blocked_id == live_session.host_id) or
          (block.blocker_id == live_session.host_id and block.blocked_id == ^viewer_id),
      where: live_session.status == :live,
      where: is_nil(host.suspended_at),
      where: is_nil(block.id),
      # Viewer-issued mutes hide matching hosts from live discovery surfaces.
      where: is_nil(mute.id),
      where:
        live_session.host_id == ^viewer_id or
          live_session.visibility == :public or
          not is_nil(follow.id),
      order_by: [
        desc: live_session.started_at,
        desc: live_session.inserted_at,
        desc: live_session.id
      ]
    )
  end

  @doc """
  Returns visible replay sessions with linked recordings, newest-ended first.
  """
  @spec replay_feed(User.t(), replay_feed_opts()) :: [LiveSession.t()]
  def replay_feed(%User{} = viewer, opts \\ []) do
    viewer
    |> replay_feed_query()
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns a deterministic query for visible replay sessions with linked recordings.
  """
  @spec replay_feed_query(User.t()) :: Ecto.Query.t()
  def replay_feed_query(%User{id: viewer_id}) when is_integer(viewer_id) do
    from(live_session in LiveSession,
      join: host in User,
      on: host.id == live_session.host_id,
      left_join: follow in Follow,
      on:
        follow.follower_id == ^viewer_id and
          follow.followed_id == live_session.host_id and
          follow.state == :accepted,
      left_join: mute in Mute,
      on: mute.muter_id == ^viewer_id and mute.muted_id == live_session.host_id,
      left_join: block in Block,
      on:
        (block.blocker_id == ^viewer_id and block.blocked_id == live_session.host_id) or
          (block.blocker_id == live_session.host_id and block.blocked_id == ^viewer_id),
      where: live_session.status == :ended,
      where: not is_nil(live_session.recording_media_asset_id),
      where: is_nil(host.suspended_at),
      where: is_nil(block.id),
      # Replay discovery mirrors retained-history visibility, not live-only
      # presence, so viewer-issued mutes still hide ended sessions.
      where: is_nil(mute.id),
      where:
        live_session.host_id == ^viewer_id or
          live_session.visibility == :public or
          not is_nil(follow.id),
      order_by: [
        desc: live_session.ended_at,
        desc: live_session.inserted_at,
        desc: live_session.id
      ]
    )
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  defp normalize_limit(opts) do
    case Keyword.get(opts, :limit, @default_limit) do
      limit when is_integer(limit) and limit > 0 -> limit
      _other -> @default_limit
    end
  end
end
