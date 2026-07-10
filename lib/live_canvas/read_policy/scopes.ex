defmodule LC.ReadPolicy.Scopes do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LCSchemas.Accounts.User
  alias LCSchemas.Social.{Block, Follow, Mute}

  @spec viewer_visible_query(Ecto.Queryable.t(), User.t(), atom(), atom()) :: Ecto.Query.t()
  def viewer_visible_query(queryable, %User{} = viewer, owner_key, visibility_key)
      when is_atom(owner_key) and is_atom(visibility_key) do
    queryable
    |> exclude_suspended_owner(owner_key)
    |> exclude_blocked_owner(viewer, owner_key)
    |> exclude_viewer_muted_owner(viewer, owner_key)
    |> allow_owner_public_or_followed(viewer, owner_key, visibility_key)
  end

  @spec exclude_owners_blocking_viewer(Ecto.Queryable.t(), User.t(), atom()) :: Ecto.Query.t()
  def exclude_owners_blocking_viewer(queryable, %User{id: viewer_id}, owner_key)
      when is_atom(owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_directional_block(viewer_id, owner_key)
    |> where([read_policy_directional_block: block], is_nil(block.id))
  end

  @spec exclude_suspended_owner(Ecto.Queryable.t(), atom()) :: Ecto.Query.t()
  defp exclude_suspended_owner(queryable, owner_key) when is_atom(owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_owner(owner_key)
    |> where([read_policy_owner: owner], is_nil(owner.suspended_at))
  end

  @spec exclude_blocked_owner(Ecto.Queryable.t(), User.t(), atom()) :: Ecto.Query.t()
  defp exclude_blocked_owner(queryable, %User{id: viewer_id}, owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_block(viewer_id, owner_key)
    |> where([read_policy_block: block], is_nil(block.id))
  end

  @spec exclude_viewer_muted_owner(Ecto.Queryable.t(), User.t(), atom()) :: Ecto.Query.t()
  defp exclude_viewer_muted_owner(queryable, %User{id: viewer_id}, owner_key) do
    queryable
    |> with_resource_binding()
    |> maybe_join_mute(viewer_id, owner_key)
    |> where([read_policy_mute: mute], is_nil(mute.id))
  end

  @spec allow_owner_public_or_followed(Ecto.Queryable.t(), User.t(), atom(), atom()) ::
          Ecto.Query.t()
  defp allow_owner_public_or_followed(
         queryable,
         %User{id: viewer_id},
         owner_key,
         visibility_key
       ) do
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

  defp with_resource_binding(queryable),
    do: from(resource in queryable, as: :read_policy_resource)

  @spec maybe_join_owner(Ecto.Query.t(), atom()) :: Ecto.Query.t()
  defp maybe_join_owner(query, owner_key) do
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
  defp maybe_join_accepted_follow(query, viewer_id, owner_key) do
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
  defp maybe_join_mute(query, viewer_id, owner_key) do
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
  defp maybe_join_block(query, viewer_id, owner_key) do
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

  @spec maybe_join_directional_block(Ecto.Query.t(), pos_integer(), atom()) :: Ecto.Query.t()
  defp maybe_join_directional_block(query, viewer_id, owner_key) do
    if has_named_binding?(query, :read_policy_directional_block) do
      query
    else
      join(query, :left, [read_policy_resource: resource], block in Block,
        as: :read_policy_directional_block,
        on:
          block.blocker_id == field(resource, ^owner_key) and
            block.blocked_id == ^viewer_id
      )
    end
  end
end
