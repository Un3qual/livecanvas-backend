defmodule LC.Content.MediaAsset do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema

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
  Injects required ownership metadata while keeping caller-provided fields intact.
  """
  @spec attrs_for_insert(pos_integer(), map()) :: attrs()
  def attrs_for_insert(owner_id, attrs) when is_integer(owner_id) and is_map(attrs) do
    Map.put(attrs, :owner_id, owner_id)
  end

  @doc """
  Builds the media-asset changeset used by the `LC.Content` boundary.
  """
  @spec changeset(MediaAssetSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%MediaAssetSchema{} = media_asset, attrs) when is_map(attrs) do
    media_asset
    |> cast(attrs, [
      :owner_id,
      :post_id,
      :storage_key,
      :mime_type,
      :processing_state,
      :width,
      :height,
      :duration_ms
    ])
    |> validate_required([:owner_id, :storage_key, :mime_type])
  end
end
