defmodule LC.Feed do
  @moduledoc """
  Read-side feed composition across content, social, and live data.
  """

  use Boundary, deps: [LC.Infra, LC.ReadPolicy, LCSchemas]

  import Ecto.Query, warn: false

  alias LC.Infra.Repo
  alias LC.ReadPolicy
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post
  alias LCSchemas.Live.LiveSession

  @default_limit 25
  @starting_session_discovery_window_seconds 10 * 60

  @type home_feed_opts :: [limit: pos_integer()]
  @type profile_posts_opts :: [limit: pos_integer()]
  @type profile_story_feed_opts :: [limit: pos_integer()]
  @type story_feed_opts :: [limit: pos_integer()]
  @type live_now_opts :: [limit: pos_integer()]
  @type profile_replay_feed_opts :: [limit: pos_integer()]
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
  Returns the viewer's visible active stories ordered newest-first.
  """
  @spec story_feed(User.t(), story_feed_opts()) :: [Post.t()]
  def story_feed(%User{} = viewer, opts \\ []) do
    viewer
    |> story_feed_query()
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns visible standard posts authored by the requested profile owner.
  """
  @spec profile_posts(User.t(), User.t(), profile_posts_opts()) :: [Post.t()]
  def profile_posts(%User{} = viewer, %User{} = owner, opts \\ []) do
    viewer
    |> profile_posts_query(owner)
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns visible active stories authored by the requested profile owner.
  """
  @spec profile_story_feed(User.t(), User.t(), profile_story_feed_opts()) :: [Post.t()]
  def profile_story_feed(%User{} = viewer, %User{} = owner, opts \\ []) do
    viewer
    |> profile_story_feed_query(owner)
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns one post when it is visible to the provided viewer or publicly visible.
  """
  @spec get_visible_post(User.t() | nil, integer()) :: Post.t() | nil
  def get_visible_post(%User{} = viewer, post_id)
      when is_integer(post_id) do
    viewer
    |> visible_post_query()
    |> where([post], post.id == ^post_id)
    |> Repo.one()
  end

  def get_visible_post(nil, post_id) when is_integer(post_id) do
    # Anonymous reads are limited to public posts from active authors so Relay
    # IDs and top-level post lookups cannot bypass follower visibility.
    from(post in Post,
      join: author in User,
      on: author.id == post.author_id,
      where:
        post.id == ^post_id and
          is_nil(author.suspended_at) and
          post.visibility == :public and
          (post.kind == :standard or
             (post.kind == :story and post.expires_at > ^DateTime.utc_now()))
    )
    |> Repo.one()
  end

  def get_visible_post(_viewer, _post_id), do: nil

  @doc """
  Returns a deterministic query for the viewer's visible home feed.
  """
  @spec home_feed_query(User.t()) :: Ecto.Query.t()
  def home_feed_query(%User{} = viewer) do
    visible_post_kind_query(viewer, :standard)
  end

  @doc """
  Returns a deterministic query for the viewer's visible active story feed.
  """
  @spec story_feed_query(User.t()) :: Ecto.Query.t()
  def story_feed_query(%User{} = viewer) do
    visible_post_kind_query(viewer, :story)
  end

  @doc """
  Returns a deterministic query for visible standard posts authored by the requested profile owner.
  """
  @spec profile_posts_query(User.t(), User.t()) :: Ecto.Query.t()
  def profile_posts_query(%User{} = viewer, %User{id: owner_id}) do
    visible_post_kind_query(viewer, :standard, owner_id)
  end

  @doc """
  Returns a deterministic query for visible active stories authored by the requested profile owner.
  """
  @spec profile_story_feed_query(User.t(), User.t()) :: Ecto.Query.t()
  def profile_story_feed_query(%User{} = viewer, %User{id: owner_id}) do
    visible_post_kind_query(viewer, :story, owner_id)
  end

  @doc """
  Returns active live sessions visible to the viewer, fresh preflight first.
  """
  @spec live_now(User.t(), live_now_opts()) :: [LiveSession.t()]
  def live_now(%User{} = viewer, opts \\ []) do
    viewer
    |> live_now_query()
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns one active live session for the requested host when it is visible to the viewer.
  """
  @spec profile_current_live_session(User.t(), User.t()) :: LiveSession.t() | nil
  def profile_current_live_session(%User{} = viewer, %User{} = host) do
    viewer
    |> profile_current_live_session_query(host)
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Returns a deterministic query for active sessions visible to the viewer.
  """
  @spec live_now_query(User.t()) :: Ecto.Query.t()
  def live_now_query(%User{} = viewer) do
    starting_discovery_cutoff =
      DateTime.utc_now()
      |> DateTime.add(-@starting_session_discovery_window_seconds, :second)

    LiveSession
    |> where(
      [live_session],
      live_session.status == :live or
        (live_session.status == :starting and
           live_session.inserted_at >= ^starting_discovery_cutoff)
    )
    |> ReadPolicy.viewer_visible_query(viewer, owner_key: :host_id, visibility_key: :visibility)
    # STARTING rows are a short-lived media preflight window, not durable host
    # presence; advertise fresh preflights first so viewers can answer hosts.
    |> order_by(
      [live_session],
      asc: fragment("CASE WHEN ? = 'starting' THEN 0 ELSE 1 END", live_session.status),
      desc_nulls_last: live_session.started_at,
      desc: live_session.inserted_at,
      desc: live_session.id
    )
  end

  @doc """
  Returns a deterministic query for the requested host's visible active sessions.
  """
  @spec profile_current_live_session_query(User.t(), User.t()) :: Ecto.Query.t()
  def profile_current_live_session_query(%User{} = viewer, %User{id: host_id}) do
    # Keep profile live-entry lookups on the same visibility pipeline as the
    # discovery feed so user-node child resolvers cannot drift from feed policy.
    viewer
    |> live_now_query()
    |> where([live_session], live_session.host_id == ^host_id)
    |> exclude(:order_by)
    # Discovery advertises fresh preflight first, but profile/current-session
    # should prefer an established broadcast when a duplicate STARTING row exists.
    |> order_by(
      [live_session],
      asc: fragment("CASE WHEN ? = 'live' THEN 0 ELSE 1 END", live_session.status),
      desc_nulls_last: live_session.started_at,
      desc: live_session.inserted_at,
      desc: live_session.id
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
  Returns visible replay sessions for the requested host, newest-ended first.
  """
  @spec profile_replay_feed(User.t(), User.t(), profile_replay_feed_opts()) :: [LiveSession.t()]
  def profile_replay_feed(%User{} = viewer, %User{} = host, opts \\ []) do
    viewer
    |> profile_replay_feed_query(host)
    |> limit(^normalize_limit(opts))
    |> Repo.all()
  end

  @doc """
  Returns a deterministic query for visible replay sessions with linked recordings.
  """
  @spec replay_feed_query(User.t()) :: Ecto.Query.t()
  def replay_feed_query(%User{} = viewer) do
    LiveSession
    |> where([live_session], live_session.status == :ended)
    |> where([live_session], not is_nil(live_session.recording_media_asset_id))
    |> ReadPolicy.viewer_visible_query(viewer, owner_key: :host_id, visibility_key: :visibility)
    |> order_by(
      [live_session],
      desc: live_session.ended_at,
      desc: live_session.inserted_at,
      desc: live_session.id
    )
  end

  @doc """
  Returns a deterministic query for visible replay sessions owned by the requested host.
  """
  @spec profile_replay_feed_query(User.t(), User.t()) :: Ecto.Query.t()
  def profile_replay_feed_query(%User{} = viewer, %User{id: host_id}) do
    # Reuse replay discovery visibility verbatim so profile replays never bypass
    # block, mute, suspension, or follower/public gating.
    viewer
    |> replay_feed_query()
    |> where([live_session], live_session.host_id == ^host_id)
  end

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  @spec visible_post_kind_query(User.t(), atom()) :: Ecto.Query.t()
  defp visible_post_kind_query(%User{} = viewer, kind) when is_atom(kind) do
    Post
    |> visible_post_query(viewer)
    |> where([post], post.kind == ^kind)
    |> order_by([post], desc: post.inserted_at, desc: post.id)
  end

  @spec visible_post_kind_query(User.t(), atom(), pos_integer() | nil) :: Ecto.Query.t()
  defp visible_post_kind_query(%User{} = viewer, kind, owner_id)
       when is_atom(kind) and is_integer(owner_id) do
    viewer
    |> visible_post_kind_query(kind)
    |> filter_author(owner_id)
  end

  defp visible_post_kind_query(%User{} = viewer, kind, nil) when is_atom(kind) do
    # Profile feeds must fail closed for unsaved owner structs instead of
    # widening into the viewer's full feed.
    viewer
    |> visible_post_kind_query(kind)
    |> where([post], false)
  end

  defp filter_author(query, owner_id) when is_integer(owner_id) do
    where(query, [post], post.author_id == ^owner_id)
  end

  @spec visible_post_query(User.t()) :: Ecto.Query.t()
  defp visible_post_query(%User{} = viewer) do
    Post
    |> visible_post_query(viewer)
  end

  @spec visible_post_query(Ecto.Queryable.t(), User.t()) :: Ecto.Query.t()
  defp visible_post_query(queryable, %User{} = viewer) do
    now = DateTime.utc_now()

    queryable
    |> ReadPolicy.viewer_visible_query(viewer, owner_key: :author_id, visibility_key: :visibility)
    # Direct lookups still need active story visibility even though the home
    # feed itself excludes stories.
    |> where(
      [read_policy_resource: post],
      post.kind == :standard or (post.kind == :story and post.expires_at > ^now)
    )
  end

  defp normalize_limit(opts) do
    case Keyword.get(opts, :limit, @default_limit) do
      limit when is_integer(limit) and limit > 0 -> limit
      _other -> @default_limit
    end
  end
end
