defmodule LC.Social do
  @moduledoc """
  The Social context.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [change: 2]

  alias LC.Infra.Repo
  alias LC.Social.RelationshipPolicy
  alias LCSchemas.Accounts.User
  alias LCSchemas.Social.{Block, Follow, Mute}

  @type relationship_state :: :accepted | :blocked | :none | :public | :requested
  @type follow_result :: {:ok, Follow.t()} | {:error, term()}
  @type block_result :: {:ok, Block.t()} | {:error, term()}
  @type mute_result :: {:ok, Mute.t()} | {:error, term()}
  @type unmute_result :: :ok
  @type decline_follow_result :: :ok | {:error, :not_allowed | Ecto.Changeset.t()}

  @doc """
  Creates or updates a follow relationship between two users.
  """
  @spec follow_user(struct(), struct()) :: follow_result()
  def follow_user(%User{id: follower_id}, %User{id: followed_id, privacy_mode: privacy_mode}) do
    with decision <-
           RelationshipPolicy.follow_decision(%{
             follower_id: follower_id,
             followed_id: followed_id,
             followed_privacy_mode: privacy_mode,
             blocked?: blocked_between?(follower_id, followed_id),
             now: DateTime.utc_now() |> DateTime.truncate(:microsecond)
           }),
         {:ok, follow} <- persist_follow(follower_id, followed_id, decision) do
      {:ok, follow}
    end
  end

  @doc """
  Accepts a pending follow request when the acted-on user owns it.
  """
  @spec accept_follow_request(struct(), struct()) :: follow_result()
  def accept_follow_request(%Follow{followed_id: followed_id} = follow, %User{id: followed_id}) do
    case follow.state do
      :accepted ->
        {:ok, follow}

      :requested ->
        follow
        |> change(%{
          state: :accepted,
          accepted_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
        })
        |> Repo.update()
    end
  end

  def accept_follow_request(%Follow{}, %User{}), do: {:error, :not_allowed}

  @doc """
  Declines a pending follow request when the acted-on user owns it.
  """
  @spec decline_follow_request(Follow.t(), User.t()) :: decline_follow_result()
  def decline_follow_request(%Follow{followed_id: followed_id, state: :requested} = follow, %User{
        id: followed_id
      }) do
    case Repo.delete(follow) do
      {:ok, _deleted_follow} -> :ok
      {:error, %Ecto.Changeset{} = changeset} -> {:error, changeset}
    end
  end

  def decline_follow_request(%Follow{}, %User{}), do: {:error, :not_allowed}

  @doc """
  Records a block relationship between two users.
  """
  @spec block_user(struct(), struct()) :: block_result()
  def block_user(%User{id: blocker_id}, %User{id: blocked_id}) do
    %Block{blocker_id: blocker_id, blocked_id: blocked_id}
    |> Repo.insert()
  end

  @doc """
  Records a mute relationship from one user to another.
  """
  @spec mute_user(struct(), struct()) :: mute_result()
  def mute_user(%User{id: muter_id}, %User{id: muted_id}) do
    %Mute{muter_id: muter_id, muted_id: muted_id}
    |> Repo.insert(
      on_conflict: :nothing,
      conflict_target: [:muter_id, :muted_id],
      returning: true
    )
    |> normalize_mute_insert(muter_id, muted_id)
  end

  @doc """
  Removes a mute relationship from one user to another.
  """
  @spec unmute_user(struct(), struct()) :: unmute_result()
  def unmute_user(%User{id: muter_id}, %User{id: muted_id}) do
    # Delete is intentionally idempotent: removing an already-missing mute is
    # still a successful unmute request from the boundary's perspective.
    from(mute in Mute,
      where: mute.muter_id == ^muter_id and mute.muted_id == ^muted_id
    )
    |> Repo.delete_all()

    :ok
  end

  @doc """
  Returns whether a directional mute relationship exists.
  """
  @spec muted?(struct(), struct()) :: boolean()
  def muted?(%User{id: muter_id}, %User{id: muted_id}) do
    Repo.exists?(
      from mute in Mute,
        where: mute.muter_id == ^muter_id and mute.muted_id == ^muted_id
    )
  end

  @doc """
  Returns the effective relationship state from a viewer to a creator.
  """
  @spec relationship_state(struct(), struct()) :: relationship_state()
  def relationship_state(%User{id: viewer_id}, %User{id: creator_id} = creator) do
    cond do
      viewer_id == creator_id ->
        :accepted

      blocked_between?(viewer_id, creator_id) ->
        :blocked

      follow_state = follow_state(viewer_id, creator_id) ->
        follow_state

      creator.privacy_mode == :public ->
        :public

      true ->
        :none
    end
  end

  @doc """
  Returns whether the viewer can see the creator's content.
  """
  @spec can_view_user?(struct(), struct()) :: boolean()
  def can_view_user?(%User{id: viewer_id}, %User{id: creator_id})
      when viewer_id == creator_id,
      do: true

  def can_view_user?(%User{} = viewer, %User{} = creator) do
    relationship_state(viewer, creator) in [:accepted, :public]
  end

  @doc """
  Returns a deterministic query for users following the given creator.
  """
  @spec follower_users_query(User.t()) :: Ecto.Query.t()
  def follower_users_query(%User{id: user_id}) do
    from(follower in User,
      join: follow in Follow,
      on: follow.follower_id == follower.id,
      where: follow.followed_id == ^user_id and follow.state == :accepted,
      # Keep a stable cursor order for Relay pagination.
      order_by: [asc: follow.inserted_at, asc: follow.id]
    )
  end

  @doc """
  Returns a deterministic query for users that the given follower follows.
  """
  @spec following_users_query(User.t()) :: Ecto.Query.t()
  def following_users_query(%User{id: user_id}) do
    from(followed in User,
      join: follow in Follow,
      on: follow.followed_id == followed.id,
      where: follow.follower_id == ^user_id and follow.state == :accepted,
      # Keep a stable cursor order for Relay pagination.
      order_by: [asc: follow.inserted_at, asc: follow.id]
    )
  end

  @doc """
  Returns a deterministic query for pending follow requests owned by the user.
  """
  @spec pending_follow_requests_query(User.t()) :: Ecto.Query.t()
  def pending_follow_requests_query(%User{id: user_id}) do
    from(follow in Follow,
      where: follow.followed_id == ^user_id and follow.state == :requested,
      preload: [:follower],
      order_by: [asc: follow.requested_at, asc: follow.id]
    )
  end

  @doc """
  Returns one pending follow request owned by the user.
  """
  @spec get_pending_follow_request(User.t(), pos_integer()) :: Follow.t() | nil
  def get_pending_follow_request(%User{id: user_id}, follow_id)
      when is_integer(follow_id) and follow_id > 0 do
    from(follow in Follow,
      where:
        follow.followed_id == ^user_id and follow.id == ^follow_id and follow.state == :requested,
      preload: [:follower],
      limit: 1
    )
    |> Repo.one()
  end

  def get_pending_follow_request(%User{}, _follow_id), do: nil

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

  defp persist_follow(_follower_id, _followed_id, {:error, reason}), do: {:error, reason}

  defp persist_follow(follower_id, followed_id, decision) do
    %Follow{
      follower_id: follower_id,
      followed_id: followed_id,
      state: decision.state,
      requested_at: decision.requested_at,
      accepted_at: decision.accepted_at
    }
    |> Repo.insert(
      on_conflict: [
        set: [
          state: decision.state,
          requested_at: decision.requested_at,
          accepted_at: decision.accepted_at
        ]
      ],
      conflict_target: [:follower_id, :followed_id],
      returning: true
    )
  end

  defp blocked_between?(left_user_id, right_user_id) do
    Repo.exists?(
      from block in Block,
        where:
          (block.blocker_id == ^left_user_id and block.blocked_id == ^right_user_id) or
            (block.blocker_id == ^right_user_id and block.blocked_id == ^left_user_id)
    )
  end

  defp follow_state(follower_id, followed_id) do
    from(follow in Follow,
      where: follow.follower_id == ^follower_id and follow.followed_id == ^followed_id,
      select: follow.state,
      limit: 1
    )
    |> Repo.one()
  end

  @spec normalize_mute_insert({:ok, Mute.t()} | {:error, term()}, pos_integer(), pos_integer()) ::
          mute_result()
  defp normalize_mute_insert({:ok, %Mute{id: nil}}, muter_id, muted_id) do
    # `on_conflict: :nothing` is used for idempotency; fetch the existing row
    # when a duplicate mute is requested so callers always receive the canonical
    # persisted mute record.
    {:ok, fetch_mute!(muter_id, muted_id)}
  end

  defp normalize_mute_insert({:ok, %Mute{} = mute}, _muter_id, _muted_id), do: {:ok, mute}
  defp normalize_mute_insert({:error, reason}, _muter_id, _muted_id), do: {:error, reason}

  @spec fetch_mute!(pos_integer(), pos_integer()) :: Mute.t()
  defp fetch_mute!(muter_id, muted_id) do
    from(mute in Mute,
      where: mute.muter_id == ^muter_id and mute.muted_id == ^muted_id,
      limit: 1
    )
    |> Repo.one!()
  end
end
