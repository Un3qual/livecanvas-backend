defmodule LiveCanvasGQL.Social.Resolver do
  alias LiveCanvas.{Accounts, Social}

  @spec follow_user(any(), map(), any()) ::
          {:ok, %{id: integer(), state: atom()}} | {:error, term()}
  def follow_user(
        _parent,
        %{input: %{follower_id: follower_id, followed_id: followed_id}},
        _resolution
      ) do
    with {:ok, follower} <- fetch_user(follower_id),
         {:ok, followed} <- fetch_user(followed_id),
         {:ok, follow} <- Social.follow_user(follower, followed) do
      {:ok, follow_payload(follow)}
    end
  end

  @spec accept_follow_request(any(), map(), any()) ::
          {:ok, %{id: integer(), state: atom()}} | {:error, term()}
  def accept_follow_request(
        _parent,
        %{
          input: %{
            follower_id: follower_id,
            followed_id: followed_id,
            acting_user_id: acting_user_id
          }
        },
        _resolution
      ) do
    with {:ok, follower} <- fetch_user(follower_id),
         {:ok, followed} <- fetch_user(followed_id),
         {:ok, acting_user} <- fetch_user(acting_user_id),
         {:ok, follow} <- Social.follow_user(follower, followed),
         {:ok, accepted_follow} <- Social.accept_follow_request(follow, acting_user) do
      {:ok, follow_payload(accepted_follow)}
    end
  end

  @spec block_user(any(), map(), any()) :: {:ok, %{successful: boolean()}}
  def block_user(
        _parent,
        %{input: %{blocker_id: blocker_id, blocked_id: blocked_id}},
        _resolution
      ) do
    with {:ok, blocker} <- fetch_user(blocker_id),
         {:ok, blocked} <- fetch_user(blocked_id),
         {:ok, _block} <- Social.block_user(blocker, blocked) do
      {:ok, %{successful: true}}
    else
      _ -> {:ok, %{successful: false}}
    end
  end

  @spec relationship_state(any(), map(), any()) :: {:ok, Social.relationship_state()}
  def relationship_state(_parent, %{viewer_id: viewer_id, creator_id: creator_id}, _resolution) do
    with {:ok, viewer} <- fetch_user(viewer_id),
         {:ok, creator} <- fetch_user(creator_id) do
      {:ok, Social.relationship_state(viewer, creator)}
    else
      _ -> {:ok, :none}
    end
  end

  @spec fetch_user(term()) :: {:ok, struct()} | {:error, :invalid_id | :not_found}
  defp fetch_user(user_id) do
    with {:ok, id} <- parse_id(user_id) do
      try do
        {:ok, Accounts.get_user!(id)}
      rescue
        Ecto.NoResultsError -> {:error, :not_found}
      end
    end
  end

  @spec follow_payload(struct()) :: %{id: integer(), state: atom()}
  defp follow_payload(follow) do
    %{id: follow.id, state: follow.state}
  end

  @spec parse_id(term()) :: {:ok, integer()} | {:error, :invalid_id}
  defp parse_id(user_id) when is_integer(user_id), do: {:ok, user_id}

  defp parse_id(user_id) when is_binary(user_id) do
    case Integer.parse(user_id) do
      {id, ""} -> {:ok, id}
      _ -> {:error, :invalid_id}
    end
  end

  defp parse_id(_user_id), do: {:error, :invalid_id}
end
