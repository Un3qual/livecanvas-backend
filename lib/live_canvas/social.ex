defmodule LiveCanvas.Social do
  @moduledoc """
  The Social context.
  """

  use Boundary, deps: [LiveCanvas.Infra, LiveCanvasSchemas]

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [change: 2]

  alias LiveCanvas.Infra.Repo
  alias LiveCanvas.Social.RelationshipPolicy
  alias LiveCanvasSchemas.Accounts.User
  alias LiveCanvasSchemas.Social.{Block, Follow}

  @type relationship_state :: :accepted | :blocked | :none | :public | :requested
  @type follow_result :: {:ok, Follow.t()} | {:error, term()}
  @type block_result :: {:ok, Block.t()} | {:error, term()}

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
  Records a block relationship between two users.
  """
  @spec block_user(struct(), struct()) :: block_result()
  def block_user(%User{id: blocker_id}, %User{id: blocked_id}) do
    %Block{blocker_id: blocker_id, blocked_id: blocked_id}
    |> Repo.insert()
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
end
