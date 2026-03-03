defmodule LC.Content do
  @moduledoc """
  The Content context.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  alias LC.Content.{MediaAsset, Post}
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema
  alias LCSchemas.Content.Post, as: PostSchema

  @type changeset :: Ecto.Changeset.t()
  @type post_result :: {:ok, PostSchema.t()} | {:error, changeset()}
  @type media_asset_result :: {:ok, MediaAssetSchema.t()} | {:error, changeset()}

  @doc """
  Persists a post owned by the given author.
  """
  @spec create_post(User.t(), map()) :: post_result()
  def create_post(%User{id: author_id}, attrs) when is_map(attrs) do
    %PostSchema{}
    |> Post.changeset(Post.attrs_for_insert(author_id, attrs))
    |> Repo.insert()
  end

  @doc """
  Persists media metadata owned by the given user.
  """
  @spec create_media_asset(User.t(), map()) :: media_asset_result()
  def create_media_asset(%User{id: owner_id}, attrs) when is_map(attrs) do
    %MediaAssetSchema{}
    |> MediaAsset.changeset(MediaAsset.attrs_for_insert(owner_id, attrs))
    |> Repo.insert()
  end

  @doc """
  Gets a post by ID.
  """
  @spec get_post(pos_integer()) :: PostSchema.t() | nil
  def get_post(id) when is_integer(id), do: Repo.get(PostSchema, id)

  @doc """
  Gets a post by ID and raises when it does not exist.
  """
  @spec get_post!(pos_integer()) :: PostSchema.t()
  def get_post!(id) when is_integer(id), do: Repo.get!(PostSchema, id)
end
