defmodule LiveCanvas.SocialFixtures do
  @moduledoc false

  alias LiveCanvas.Social
  alias LiveCanvasSchemas.Social.{Block, Follow}

  @spec follow_fixture(struct(), struct()) :: Follow.t()
  def follow_fixture(follower, followed) do
    {:ok, follow} = Social.follow_user(follower, followed)
    follow
  end

  @spec accepted_follow_fixture(struct(), struct()) :: Follow.t()
  def accepted_follow_fixture(follower, followed) do
    follower
    |> follow_fixture(followed)
    |> maybe_accept_follow(followed)
  end

  @spec block_fixture(struct(), struct()) :: Block.t()
  def block_fixture(blocker, blocked) do
    {:ok, block} = Social.block_user(blocker, blocked)
    block
  end

  defp maybe_accept_follow(%Follow{state: :accepted} = follow, _followed), do: follow

  defp maybe_accept_follow(%Follow{} = follow, followed) do
    {:ok, accepted_follow} = Social.accept_follow_request(follow, followed)
    accepted_follow
  end
end
