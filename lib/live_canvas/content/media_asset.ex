defmodule LC.Content.MediaAsset do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema

  @supported_mime_types ["image/jpeg", "image/png", "image/webp", "video/mp4"]

  @type attrs :: %{
          optional(
            :owner_id
            | :post_id
            | :storage_key
            | :mime_type
            | :processing_state
            | :width
            | :height
            | :duration_ms
            | String.t()
          ) => term()
        }

  @doc """
  Builds insert attrs for upload-intent flows while enforcing server-owned
  storage keys and initial lifecycle state.
  """
  @spec attrs_for_upload_request(pos_integer(), map(), String.t()) :: attrs()
  def attrs_for_upload_request(owner_id, attrs, storage_key)
      when is_integer(owner_id) and is_map(attrs) and is_binary(storage_key) do
    attrs
    |> Map.put(:storage_key, storage_key)
    |> Map.put(:owner_id, owner_id)
  end

  @doc """
  Builds a new upload intent with server-owned ownership, key, and lifecycle state.
  """
  @spec upload_request_changeset(MediaAssetSchema.t(), attrs()) :: Ecto.Changeset.t()
  def upload_request_changeset(%MediaAssetSchema{} = media_asset, attrs) when is_map(attrs) do
    media_asset
    |> cast(attrs, [:owner_id, :storage_key, :mime_type])
    |> put_change(:processing_state, :pending_upload)
    |> validate_required([:owner_id, :storage_key, :mime_type])
    |> validate_inclusion(:mime_type, @supported_mime_types, message: "is not supported")
    |> foreign_key_constraint(:owner_id)
  end

  @doc """
  Attaches an existing processed asset to a server-created post.
  """
  @spec attachment_changeset(MediaAssetSchema.t(), attrs()) :: Ecto.Changeset.t()
  def attachment_changeset(%MediaAssetSchema{} = media_asset, attrs) when is_map(attrs) do
    media_asset
    |> cast(attrs, [:post_id])
    |> validate_required([:post_id])
    |> foreign_key_constraint(:post_id)
  end

  @doc """
  Applies lifecycle and processor-owned metadata after domain authorization.
  """
  @spec processing_changeset(MediaAssetSchema.t(), attrs()) :: Ecto.Changeset.t()
  def processing_changeset(%MediaAssetSchema{} = media_asset, attrs) when is_map(attrs) do
    media_asset
    |> cast(attrs, [:processing_state, :width, :height, :duration_ms])
    |> validate_required([:processing_state])
  end
end
