defmodule LC.Content do
  @moduledoc """
  The Content context.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  alias LC.Content.{MediaAsset, Post}
  alias LC.Infra.{ObjectStorage, Repo}
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema
  alias LCSchemas.Content.Post, as: PostSchema

  @type changeset :: Ecto.Changeset.t()
  @type post_result :: {:ok, PostSchema.t()} | {:error, changeset()}
  @type media_asset_result :: {:ok, MediaAssetSchema.t()} | {:error, changeset()}
  @type media_upload_result ::
          {:ok, %{media_asset: MediaAssetSchema.t(), upload: ObjectStorage.signed_upload()}}
          | {:error, changeset() | :invalid_upload_request | term()}

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
  Creates a viewer-owned media row and returns signed upload instructions.
  """
  @spec request_media_upload(User.t(), map()) :: media_upload_result()
  def request_media_upload(%User{id: owner_id}, attrs) when is_map(attrs) do
    storage_key = generate_storage_key(owner_id, attrs)

    changeset =
      %MediaAssetSchema{}
      |> MediaAsset.changeset(MediaAsset.attrs_for_upload_request(owner_id, attrs, storage_key))

    if changeset.valid? do
      mime_type = Ecto.Changeset.get_field(changeset, :mime_type)

      # Upload keys stay server-owned so clients cannot overwrite arbitrary
      # objects by submitting their own storage_key values.
      with {:ok, upload} <- ObjectStorage.sign_upload(%{key: storage_key, mime_type: mime_type}),
           {:ok, media_asset} <- Repo.insert(changeset) do
        {:ok, %{media_asset: media_asset, upload: upload}}
      end
    else
      {:error, changeset}
    end
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

  @doc """
  Gets a media asset by ID when owned by the provided viewer.
  """
  @spec get_user_media_asset(User.t(), pos_integer()) :: MediaAssetSchema.t() | nil
  def get_user_media_asset(%User{id: owner_id}, media_asset_id)
      when is_integer(media_asset_id) and media_asset_id > 0 do
    Repo.get_by(MediaAssetSchema, id: media_asset_id, owner_id: owner_id)
  end

  @spec generate_storage_key(pos_integer(), map()) :: String.t()
  defp generate_storage_key(owner_id, attrs) do
    random_suffix = :crypto.strong_rand_bytes(12) |> Base.url_encode64(padding: false)
    extension = attrs |> mime_type_from_attrs() |> mime_extension()

    "uploads/users/#{owner_id}/#{random_suffix}#{extension}"
  end

  @spec mime_type_from_attrs(map()) :: String.t() | nil
  defp mime_type_from_attrs(attrs) do
    Map.get(attrs, :mime_type) || Map.get(attrs, "mime_type")
  end

  @spec mime_extension(String.t() | nil) :: String.t()
  defp mime_extension("image/jpeg"), do: ".jpg"
  defp mime_extension("image/png"), do: ".png"
  defp mime_extension("image/webp"), do: ".webp"
  defp mime_extension("video/mp4"), do: ".mp4"
  defp mime_extension(_mime_type), do: ".bin"
end
