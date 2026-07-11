defmodule LC.Social do
  @moduledoc """
  The Social context.
  """

  use Boundary, deps: [LC.Infra, LC.ReadPolicy, LCSchemas]

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [change: 2]

  alias LC.Infra.Repo
  alias LC.ReadPolicy
  alias LC.Social.RelationshipPolicy
  alias LCSchemas.Accounts.User
  alias LCSchemas.Social.{Block, Follow, Mute}

  @type follow_result :: {:ok, Follow.t()} | {:error, term()}
  @type block_result :: {:ok, Block.t()} | {:error, term()}
  @type mute_result :: {:ok, Mute.t()} | {:error, term()}
  @type unfollow_result :: :ok
  @type unblock_result :: :ok
  @type unmute_result :: :ok
  @type decline_follow_result :: :ok | {:error, :not_allowed | Ecto.Changeset.t()}
  @type relationship_graph_query_result :: {:ok, Ecto.Query.t()} | :hidden

  @doc """
  Creates or updates a follow relationship between two users.
  """
  @spec follow_user(struct(), struct()) :: follow_result()
  def follow_user(
        %User{id: follower_id} = follower,
        %User{id: followed_id, privacy_mode: privacy_mode} = followed
      ) do
    with decision <-
           RelationshipPolicy.follow_decision(%{
             follower_id: follower_id,
             followed_id: followed_id,
             followed_privacy_mode: privacy_mode,
             blocked?: ReadPolicy.blocked_between?(follower, followed),
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
  def block_user(%User{id: user_id}, %User{id: user_id}) when is_integer(user_id),
    do: {:error, :not_allowed}

  def block_user(%User{id: blocker_id}, %User{id: blocked_id}) do
    %Block{blocker_id: blocker_id, blocked_id: blocked_id}
    |> Repo.insert()
  end

  @doc """
  Removes the authenticated follower's directional relationship to a user.
  """
  @spec unfollow_user(User.t(), User.t()) :: unfollow_result()
  def unfollow_user(%User{id: follower_id}, %User{id: followed_id}) do
    from(follow in Follow,
      where: follow.follower_id == ^follower_id and follow.followed_id == ^followed_id
    )
    |> Repo.delete_all()

    :ok
  end

  @doc """
  Removes the authenticated blocker's directional block of a user.
  """
  @spec unblock_user(User.t(), User.t()) :: unblock_result()
  def unblock_user(%User{id: blocker_id}, %User{id: blocked_id}) do
    from(block in Block,
      where: block.blocker_id == ^blocker_id and block.blocked_id == ^blocked_id
    )
    |> Repo.delete_all()

    :ok
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
  Returns the followers graph when it is visible to the optional viewer.
  """
  @spec visible_follower_users_query(User.t(), User.t() | nil) ::
          relationship_graph_query_result()
  def visible_follower_users_query(%User{} = owner, viewer) do
    visible_relationship_graph_query(owner, viewer, follower_users_query(owner))
  end

  @doc """
  Returns the following graph when it is visible to the optional viewer.
  """
  @spec visible_following_users_query(User.t(), User.t() | nil) ::
          relationship_graph_query_result()
  def visible_following_users_query(%User{} = owner, viewer) do
    visible_relationship_graph_query(owner, viewer, following_users_query(owner))
  end

  @spec follower_users_query(User.t()) :: Ecto.Query.t()
  defp follower_users_query(%User{id: user_id}) do
    from(follower in User,
      join: follow in Follow,
      on: follow.follower_id == follower.id,
      where: follow.followed_id == ^user_id and follow.state == :accepted,
      order_by: [asc: follow.inserted_at, asc: follow.id]
    )
  end

  @spec following_users_query(User.t()) :: Ecto.Query.t()
  defp following_users_query(%User{id: user_id}) do
    from(followed in User,
      join: follow in Follow,
      on: follow.followed_id == followed.id,
      where: follow.follower_id == ^user_id and follow.state == :accepted,
      order_by: [asc: follow.inserted_at, asc: follow.id]
    )
  end

  @spec visible_relationship_graph_query(User.t(), User.t() | nil, Ecto.Query.t()) ::
          relationship_graph_query_result()
  defp visible_relationship_graph_query(%User{privacy_mode: :public}, nil, query),
    do: {:ok, query}

  defp visible_relationship_graph_query(%User{} = owner, %User{} = viewer, query) do
    if ReadPolicy.viewer_can_view_relationship_graph?(viewer, owner) do
      {:ok, ReadPolicy.relationship_graph_users_query(query, viewer)}
    else
      :hidden
    end
  end

  defp visible_relationship_graph_query(%User{}, nil, _query), do: :hidden

  @doc """
  Returns a deterministic query for pending follow requests owned by the user.
  """
  @spec pending_follow_requests_query(User.t()) :: Ecto.Query.t()
  def pending_follow_requests_query(%User{id: user_id} = user) do
    from(follow in Follow,
      where: follow.followed_id == ^user_id and follow.state == :requested,
      preload: [:follower],
      order_by: [asc: follow.requested_at, asc: follow.id]
    )
    |> ReadPolicy.visible_pending_follow_requests_query(user)
  end

  @doc """
  Returns one pending follow request owned by the user.
  """
  @spec get_pending_follow_request(User.t(), integer()) :: Follow.t() | nil
  def get_pending_follow_request(%User{id: user_id} = user, follow_id)
      when is_integer(follow_id) do
    from(follow in Follow,
      where:
        follow.followed_id == ^user_id and follow.id == ^follow_id and follow.state == :requested,
      preload: [:follower],
      limit: 1
    )
    |> ReadPolicy.visible_pending_follow_requests_query(user)
    |> Repo.one()
  end

  def get_pending_follow_request(%User{}, _follow_id), do: nil

  @doc """
  Returns one pending follow request for the given follower/acted-on user pair.
  """
  @spec get_pending_follow_request_for_follower(User.t(), User.t()) :: Follow.t() | nil
  def get_pending_follow_request_for_follower(%User{id: followed_id}, %User{id: follower_id}) do
    from(follow in Follow,
      where:
        follow.followed_id == ^followed_id and follow.follower_id == ^follower_id and
          follow.state == :requested,
      preload: [:follower],
      limit: 1
    )
    |> Repo.one()
  end

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
