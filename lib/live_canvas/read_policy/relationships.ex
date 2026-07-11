defmodule LC.ReadPolicy.Relationships do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Social.{Block, Follow, Mute}

  @spec blocked_by?(User.t(), User.t()) :: boolean()
  def blocked_by?(%User{id: blocked_id}, %User{id: blocker_id}) do
    Repo.exists?(
      from block in Block,
        where: block.blocker_id == ^blocker_id and block.blocked_id == ^blocked_id
    )
  end

  @spec blocked_between?(User.t(), User.t()) :: boolean()
  def blocked_between?(%User{id: left_user_id}, %User{id: right_user_id}) do
    Repo.exists?(
      from block in Block,
        where:
          (block.blocker_id == ^left_user_id and block.blocked_id == ^right_user_id) or
            (block.blocker_id == ^right_user_id and block.blocked_id == ^left_user_id)
    )
  end

  @spec blocked_peer_ids(User.t()) :: [pos_integer()]
  def blocked_peer_ids(%User{id: user_id}) when is_integer(user_id) do
    from(block in Block,
      where: block.blocker_id == ^user_id or block.blocked_id == ^user_id,
      select: {block.blocker_id, block.blocked_id}
    )
    |> Repo.all()
    |> Enum.map(fn
      {^user_id, peer_id} -> peer_id
      {peer_id, ^user_id} -> peer_id
    end)
  end

  @spec muted?(User.t(), User.t()) :: boolean()
  def muted?(%User{id: muter_id}, %User{id: muted_id}) do
    Repo.exists?(
      from mute in Mute,
        where: mute.muter_id == ^muter_id and mute.muted_id == ^muted_id
    )
  end

  @spec follow_state(User.t(), User.t()) :: :accepted | :requested | nil
  def follow_state(%User{id: follower_id}, %User{id: followed_id}) do
    from(follow in Follow,
      where: follow.follower_id == ^follower_id and follow.followed_id == ^followed_id,
      select: follow.state,
      limit: 1
    )
    |> Repo.one()
  end

  @spec blocking_owner_ids(User.t(), [pos_integer()]) :: [pos_integer()]
  def blocking_owner_ids(%User{}, []), do: []

  def blocking_owner_ids(%User{id: viewer_id}, owner_ids) when is_list(owner_ids) do
    from(block in Block,
      where: block.blocked_id == ^viewer_id and block.blocker_id in ^owner_ids,
      select: block.blocker_id,
      order_by: [asc: block.blocker_id]
    )
    |> Repo.all()
  end
end
