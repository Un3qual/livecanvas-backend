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
  Returns one post when it is visible to the provided viewer or publicly visible.
  """
  @spec get_visible_post(User.t() | nil, pos_integer()) :: Post.t() | nil
  def get_visible_post(%User{} = viewer, post_id)
      when is_integer(post_id) and post_id > 0 do
    viewer
    |> home_feed_query()
    |> where([post], post.id == ^post_id)
    |> Repo.one()
  end

  def get_visible_post(nil, post_id) when is_integer(post_id) and post_id > 0 do
    # Anonymous reads are limited to public posts from active authors so Relay
    # IDs and top-level post lookups cannot bypass follower visibility.
    from(post in Post,
      join: author in User,
      on: author.id == post.author_id,
      where: post.id == ^post_id and is_nil(author.suspended_at) and post.visibility == :public
    )
    |> Repo.one()
  end

  def get_visible_post(_viewer, _post_id), do: nil

  @doc """
  Returns a deterministic query for the viewer's visible home feed.
  """
  @spec home_feed_query(User.t()) :: Ecto.Query.t()
  def home_feed_query(%User{} = viewer) do
    Post
    |> ReadPolicy.viewer_visible_query(viewer, owner_key: :author_id, visibility_key: :visibility)
    |> order_by([post], desc: post.inserted_at, desc: post.id)
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
  def live_now_query(%User{} = viewer) do
    LiveSession
    |> where([live_session], live_session.status == :live)
    |> ReadPolicy.viewer_visible_query(viewer, owner_key: :host_id, visibility_key: :visibility)
    |> order_by(
      [live_session],
      desc: live_session.started_at,
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
