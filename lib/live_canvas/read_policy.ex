defmodule LC.ReadPolicy do
  @moduledoc """
  Shared viewer-scoped query helpers for read surfaces.
  """

  use Boundary, deps: [LCSchemas]

  import Ecto.Query, warn: false

  alias LCSchemas.Accounts.User
  alias LCSchemas.Social.{Block, Follow, Mute}

  @type visible_resource_opt :: {:owner_key, atom()} | {:visibility_key, atom()}
  @type visible_resource_opts :: [visible_resource_opt]

  @doc """
  Applies the shared blocked, muted, and follow/public visibility policy for a viewer.
  """
  @spec viewer_visible_query(Ecto.Queryable.t(), User.t(), visible_resource_opts()) ::
          Ecto.Query.t()
  def viewer_visible_query(queryable, %User{} = viewer, opts) when is_list(opts) do
    owner_key = Keyword.fetch!(opts, :owner_key)
    visibility_key = Keyword.fetch!(opts, :visibility_key)

    queryable
    |> exclude_suspended_owner(owner_key)
    |> exclude_blocked_owner(viewer, owner_key)
    |> exclude_viewer_muted_owner(viewer, owner_key)
    |> allow_owner_public_or_followed(viewer, owner_key, visibility_key)
  end

  @doc """
  Joins the resource owner so callers can share active-account checks.
  """
  @spec join_owner(Ecto.Queryable.t(), atom()) :: Ecto.Query.t()
  def join_owner(queryable, owner_key) when is_atom(owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_owner(owner_key)
  end

  @doc """
  Excludes resources whose owner account is suspended.
  """
  @spec exclude_suspended_owner(Ecto.Queryable.t(), atom()) :: Ecto.Query.t()
  def exclude_suspended_owner(queryable, owner_key) when is_atom(owner_key) do
    queryable
    |> join_owner(owner_key)
    |> where([read_policy_owner: owner], is_nil(owner.suspended_at))
  end

  @doc """
  Excludes resources hidden by a block in either direction between viewer and owner.
  """
  @spec exclude_blocked_owner(Ecto.Queryable.t(), User.t(), atom()) :: Ecto.Query.t()
  def exclude_blocked_owner(queryable, %User{id: viewer_id}, owner_key) when is_atom(owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_block(viewer_id, owner_key)
    |> where([read_policy_block: block], is_nil(block.id))
  end

  @doc """
  Excludes resources from owners muted by the viewer.
  """
  @spec exclude_viewer_muted_owner(Ecto.Queryable.t(), User.t(), atom()) :: Ecto.Query.t()
  def exclude_viewer_muted_owner(queryable, %User{id: viewer_id}, owner_key)
      when is_atom(owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_mute(viewer_id, owner_key)
    # Mute checks are directional: only the viewer muting the owner suppresses visibility.
    |> where([read_policy_mute: mute], is_nil(mute.id))
  end

  @doc """
  Limits visible resources to the owner, public rows, or accepted follows from the viewer.
  """
  @spec allow_owner_public_or_followed(Ecto.Queryable.t(), User.t(), atom(), atom()) ::
          Ecto.Query.t()
  def allow_owner_public_or_followed(queryable, %User{id: viewer_id}, owner_key, visibility_key)
      when is_atom(owner_key) and is_atom(visibility_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_accepted_follow(viewer_id, owner_key)
    |> where(
      [read_policy_resource: resource, read_policy_follow: follow],
      field(resource, ^owner_key) == ^viewer_id or
        field(resource, ^visibility_key) == :public or
        not is_nil(follow.id)
    )
  end

  @spec with_resource_binding(Ecto.Queryable.t()) :: Ecto.Query.t()
  defp with_resource_binding(%Ecto.Query{} = query) do
    if has_named_binding?(query, :read_policy_resource) do
      query
    else
      from(resource in query, as: :read_policy_resource)
    end
  end

  defp with_resource_binding(queryable) do
    from(resource in queryable, as: :read_policy_resource)
  end

  @spec maybe_join_owner(Ecto.Query.t(), atom()) :: Ecto.Query.t()
  defp maybe_join_owner(query, owner_key) when is_atom(owner_key) do
    if has_named_binding?(query, :read_policy_owner) do
      query
    else
      join(query, :inner, [read_policy_resource: resource], owner in User,
        as: :read_policy_owner,
        on: owner.id == field(resource, ^owner_key)
      )
    end
  end

  @spec maybe_join_accepted_follow(Ecto.Query.t(), pos_integer(), atom()) :: Ecto.Query.t()
  defp maybe_join_accepted_follow(query, viewer_id, owner_key)
       when is_integer(viewer_id) and is_atom(owner_key) do
    if has_named_binding?(query, :read_policy_follow) do
      query
    else
      join(query, :left, [read_policy_resource: resource], follow in Follow,
        as: :read_policy_follow,
        on:
          follow.follower_id == ^viewer_id and
            follow.followed_id == field(resource, ^owner_key) and
            follow.state == :accepted
      )
    end
  end

  @spec maybe_join_mute(Ecto.Query.t(), pos_integer(), atom()) :: Ecto.Query.t()
  defp maybe_join_mute(query, viewer_id, owner_key)
       when is_integer(viewer_id) and is_atom(owner_key) do
    if has_named_binding?(query, :read_policy_mute) do
      query
    else
      join(query, :left, [read_policy_resource: resource], mute in Mute,
        as: :read_policy_mute,
        on: mute.muter_id == ^viewer_id and mute.muted_id == field(resource, ^owner_key)
      )
    end
  end

  @spec maybe_join_block(Ecto.Query.t(), pos_integer(), atom()) :: Ecto.Query.t()
  defp maybe_join_block(query, viewer_id, owner_key)
       when is_integer(viewer_id) and is_atom(owner_key) do
    if has_named_binding?(query, :read_policy_block) do
      query
    else
      join(query, :left, [read_policy_resource: resource], block in Block,
        as: :read_policy_block,
        on:
          (block.blocker_id == ^viewer_id and
             block.blocked_id == field(resource, ^owner_key)) or
            (block.blocker_id == field(resource, ^owner_key) and
               block.blocked_id == ^viewer_id)
      )
    end
  end
end
