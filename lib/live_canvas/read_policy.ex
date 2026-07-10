defmodule LC.ReadPolicy do
  @moduledoc """
  Viewer-scoped read decisions and action-specific query policies.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  alias LC.ReadPolicy.{Relationships, Scopes}
  alias LCSchemas.Accounts.User

  @type owner_visibility :: :followers | :private | :public
  @type relationship_state :: :accepted | :blocked | :none | :public | :requested

  @doc """
  Returns whether the owner blocked the viewer.
  """
  @spec viewer_blocked_by_owner?(User.t(), User.t()) :: boolean()
  def viewer_blocked_by_owner?(%User{} = viewer, %User{} = owner),
    do: Relationships.blocked_by?(viewer, owner)

  @doc """
  Returns whether either user blocked the other.
  """
  @spec blocked_between?(User.t(), User.t()) :: boolean()
  def blocked_between?(%User{} = left, %User{} = right),
    do: Relationships.blocked_between?(left, right)

  @doc """
  Returns owner IDs whose users blocked the viewer.
  """
  @spec blocking_owner_ids(User.t(), [pos_integer()]) :: [pos_integer()]
  def blocking_owner_ids(%User{} = viewer, owner_ids) when is_list(owner_ids),
    do: Relationships.blocking_owner_ids(viewer, owner_ids)

  @doc """
  Returns whether the viewer has muted the owner.
  """
  @spec viewer_muted_owner?(User.t(), User.t()) :: boolean()
  def viewer_muted_owner?(%User{} = viewer, %User{} = owner),
    do: Relationships.muted?(viewer, owner)

  @doc """
  Returns the IDs of every user with a block relationship to the given user.

  Realtime delivery uses this batched fact to avoid one block query per
  connected viewer.
  """
  @spec blocked_peer_ids(User.t()) :: [pos_integer()]
  def blocked_peer_ids(%User{} = user), do: Relationships.blocked_peer_ids(user)

  @doc """
  Returns the viewer's relationship state using the owner's persisted privacy mode.
  """
  @spec relationship_state(User.t(), User.t()) :: relationship_state()
  def relationship_state(
        %User{} = viewer,
        %User{privacy_mode: visibility} = owner
      )
      when visibility in [:private, :public] do
    relationship_state_for_visibility(viewer, owner, visibility)
  end

  @doc """
  Returns whether the viewer may inspect the owner's relationship graph.

  Unlike content reads, this decision deliberately ignores viewer mute state.
  """
  @spec viewer_can_view_relationship_graph?(User.t(), User.t()) :: boolean()
  def viewer_can_view_relationship_graph?(%User{} = viewer, %User{} = owner) do
    relationship_state(viewer, owner) in [:accepted, :public]
  end

  @doc """
  Returns whether the viewer can read owner-scoped content for the given resource visibility.
  """
  @spec viewer_can_read_owner?(User.t(), User.t(), owner_visibility()) :: boolean()
  def viewer_can_read_owner?(%User{} = viewer, %User{} = owner, visibility)
      when visibility in [:followers, :private, :public] do
    relationship_state = relationship_state_for_visibility(viewer, owner, visibility)

    # Directional mutes hide owner-scoped reads even when the owner remains
    # public or followed from the viewer's perspective.
    #
    # Public visibility stays readable even if a stale `:requested` follow row
    # remains after the owner switches privacy modes.
    not viewer_muted_owner?(viewer, owner) and
      relationship_state != :blocked and
      (visibility == :public or relationship_state == :accepted)
  end

  @doc """
  Applies owner visibility policy to post queries.
  """
  @spec visible_posts_query(Ecto.Queryable.t(), User.t()) :: Ecto.Query.t()
  def visible_posts_query(queryable, %User{} = viewer),
    do: Scopes.viewer_visible_query(queryable, viewer, :author_id, :visibility)

  @doc """
  Applies owner visibility policy to live-session queries.
  """
  @spec visible_live_sessions_query(Ecto.Queryable.t(), User.t()) :: Ecto.Query.t()
  def visible_live_sessions_query(queryable, %User{} = viewer),
    do: Scopes.viewer_visible_query(queryable, viewer, :host_id, :visibility)

  @doc """
  Applies directional identity privacy to relationship-graph user queries.
  """
  @spec relationship_graph_users_query(Ecto.Queryable.t(), User.t()) :: Ecto.Query.t()
  def relationship_graph_users_query(queryable, %User{} = viewer),
    do: Scopes.exclude_owners_blocking_viewer(queryable, viewer, :id)

  @doc """
  Excludes follow requests whose requester blocked the request owner.
  """
  @spec visible_pending_follow_requests_query(Ecto.Queryable.t(), User.t()) :: Ecto.Query.t()
  def visible_pending_follow_requests_query(queryable, %User{} = viewer),
    do: Scopes.exclude_owners_blocking_viewer(queryable, viewer, :follower_id)

  @spec relationship_state_for_visibility(User.t(), User.t(), owner_visibility()) ::
          relationship_state()
  defp relationship_state_for_visibility(
         %User{id: viewer_id} = viewer,
         %User{id: owner_id} = owner,
         visibility
       )
       when is_integer(viewer_id) and is_integer(owner_id) do
    cond do
      viewer_id == owner_id -> :accepted
      Relationships.blocked_between?(viewer, owner) -> :blocked
      follow_state = Relationships.follow_state(viewer, owner) -> follow_state
      visibility == :public -> :public
      true -> :none
    end
  end
end
