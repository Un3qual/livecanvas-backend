defmodule LC.Content do
  @moduledoc """
  The Content context.
  """

  use Boundary, deps: [LC.Infra, LCSchemas]

  alias LC.Content.{MediaAsset, MediaProcessing, Post}
  alias LC.Infra.{AsyncJobs, ObjectStorage, Repo, WebhookEvent}
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema
  alias LCSchemas.Content.Post, as: PostSchema
  alias LCSchemas.Infra.WebhookEvent, as: WebhookEventSchema

  @type changeset :: Ecto.Changeset.t()
  @type post_result :: {:ok, PostSchema.t()} | {:error, changeset()}
  @type media_asset_result :: {:ok, MediaAssetSchema.t()} | {:error, changeset()}
  @type media_upload_result ::
          {:ok, %{media_asset: MediaAssetSchema.t(), upload: ObjectStorage.signed_upload()}}
          | {:error, changeset() | :invalid_upload_request | term()}
  @type media_finalize_result :: {:ok, MediaAssetSchema.t()} | {:error, changeset() | atom()}
  @type webhook_ingest_result ::
          {:ok, :accepted | :duplicate}
          | {:error, :enqueue_failed | :invalid_payload | Ecto.Changeset.t()}

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
  Records a signed media-processing callback and enqueues async handling.
  """
  @spec ingest_media_processing_webhook(String.t(), map()) :: webhook_ingest_result()
  def ingest_media_processing_webhook(event_id, payload)
      when is_binary(event_id) and is_map(payload) do
    with {:ok, normalized_payload} <- validate_media_processing_webhook_payload(payload),
         {:ok, webhook_event, result} <-
           WebhookEvent.record_event("media_processing", event_id, %{
             event_type: normalized_payload["event_type"],
             payload: normalized_payload
           }),
         :ok <- enqueue_media_processing_webhook(webhook_event, result) do
      {:ok, normalize_webhook_result(result)}
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

  @doc """
  Finalizes a pending upload for the owner and runs media processing.
  """
  @spec finalize_media_upload(User.t(), pos_integer(), map()) :: media_finalize_result()
  def finalize_media_upload(%User{} = owner, media_asset_id, attrs)
      when is_integer(media_asset_id) and media_asset_id > 0 and is_map(attrs) do
    case get_user_media_asset(owner, media_asset_id) do
      nil ->
        {:error, :not_found}

      %MediaAssetSchema{processing_state: :processed} = media_asset ->
        {:ok, media_asset}

      %MediaAssetSchema{processing_state: :uploaded} = media_asset ->
        process_uploaded_media(media_asset)

      %MediaAssetSchema{processing_state: :failed} ->
        {:error, :processing_failed}

      %MediaAssetSchema{processing_state: :pending_upload} = media_asset ->
        finalize_pending_upload(media_asset, attrs)
    end
  end

  @spec finalize_pending_upload(MediaAssetSchema.t(), map()) :: media_finalize_result()
  defp finalize_pending_upload(media_asset, attrs) do
    with {:ok, uploaded_asset} <-
           update_media_asset(media_asset, Map.put(attrs, :processing_state, :uploaded)) do
      process_uploaded_media(uploaded_asset)
    end
  end

  @spec process_uploaded_media(MediaAssetSchema.t()) :: media_finalize_result()
  defp process_uploaded_media(uploaded_asset) do
    # Upload completion and processor invocation are split so upload metadata
    # is durably recorded even when downstream processing fails.
    case MediaProcessing.process_upload(uploaded_asset) do
      {:ok, processing_attrs} ->
        processing_attrs
        |> Map.put(:processing_state, :processed)
        |> then(&update_media_asset(uploaded_asset, &1))

      {:error, _reason} ->
        _ = update_media_asset(uploaded_asset, %{processing_state: :failed})
        {:error, :processing_failed}
    end
  end

  @spec update_media_asset(MediaAssetSchema.t(), map()) ::
          {:ok, MediaAssetSchema.t()} | {:error, changeset()}
  defp update_media_asset(%MediaAssetSchema{} = media_asset, attrs) when is_map(attrs) do
    media_asset
    |> MediaAsset.changeset(attrs)
    |> Repo.update()
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

  @spec validate_media_processing_webhook_payload(map()) ::
          {:ok, map()} | {:error, :invalid_payload}
  defp validate_media_processing_webhook_payload(payload) when is_map(payload) do
    with event_type when is_binary(event_type) <- Map.get(payload, "event_type"),
         media_asset_id when is_integer(media_asset_id) and media_asset_id > 0 <-
           Map.get(payload, "media_asset_id") do
      {:ok, payload}
    else
      _ -> {:error, :invalid_payload}
    end
  end

  @spec enqueue_media_processing_webhook(WebhookEventSchema.t(), :duplicate | :inserted) ::
          :ok | {:error, :enqueue_failed}
  defp enqueue_media_processing_webhook(_webhook_event, :duplicate), do: :ok

  defp enqueue_media_processing_webhook(
         %{external_event_id: external_event_id, id: webhook_event_id},
         :inserted
       )
       when is_binary(external_event_id) and is_integer(webhook_event_id) do
    # Callback providers retry aggressively; this dedupe key ensures the same
    # external event cannot enqueue duplicate work across retries.
    case AsyncJobs.enqueue(
           "media_processing_webhook",
           %{webhook_event_id: webhook_event_id},
           dedupe_key: "webhook_event:media_processing:#{external_event_id}"
         ) do
      {:ok, _job} -> :ok
      {:error, _reason} -> {:error, :enqueue_failed}
    end
  end

  @spec normalize_webhook_result(:duplicate | :inserted) :: :accepted | :duplicate
  defp normalize_webhook_result(:inserted), do: :accepted
  defp normalize_webhook_result(:duplicate), do: :duplicate
end
