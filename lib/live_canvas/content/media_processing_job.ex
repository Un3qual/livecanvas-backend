defmodule LC.Content.MediaProcessingJob do
  @moduledoc false

  import Ecto.Changeset

  alias LC.Content.{MediaAsset, MediaProcessing}
  alias LC.Infra.{Payload, Repo}
  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  @behaviour LC.Infra.AsyncJobs.Handler

  @media_processing_job_kind "media_asset_processing"
  @webhook_job_kind "media_processing_webhook"
  @default_retry_backoff_seconds 30

  @type webhook_payload :: map()

  @impl LC.Infra.AsyncJobs.Handler
  @spec handle(AsyncJob.t()) :: LC.Infra.AsyncJobs.Handler.result()
  def handle(%AsyncJob{kind: @media_processing_job_kind} = job), do: handle_media_processing(job)
  def handle(%AsyncJob{kind: @webhook_job_kind} = job), do: handle_webhook_processing(job)
  def handle(%AsyncJob{}), do: {:error, :unsupported_job_kind}

  @spec handle_media_processing(AsyncJob.t()) :: LC.Infra.AsyncJobs.Handler.result()
  defp handle_media_processing(%AsyncJob{payload: payload} = job) when is_map(payload) do
    with {:ok, media_asset_id} <- Payload.positive_integer(payload, :media_asset_id),
         %MediaAssetSchema{} = media_asset <- Repo.get(MediaAssetSchema, media_asset_id) do
      process_media_asset(job, media_asset)
    else
      nil ->
        # A missing asset should not poison the queue forever; this no-op keeps
        # handler behavior idempotent for deleted assets.
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec handle_webhook_processing(AsyncJob.t()) :: LC.Infra.AsyncJobs.Handler.result()
  defp handle_webhook_processing(%AsyncJob{payload: payload}) when is_map(payload) do
    with {:ok, webhook_event_id} <- Payload.positive_integer(payload, :webhook_event_id),
         %WebhookEvent{} = webhook_event <- Repo.get(WebhookEvent, webhook_event_id) do
      process_webhook_event(webhook_event)
    else
      nil ->
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec process_media_asset(AsyncJob.t(), MediaAssetSchema.t()) ::
          LC.Infra.AsyncJobs.Handler.result()
  defp process_media_asset(_job, %MediaAssetSchema{processing_state: :processed}), do: :ok
  defp process_media_asset(_job, %MediaAssetSchema{processing_state: :failed}), do: :ok

  defp process_media_asset(job, %MediaAssetSchema{processing_state: :uploaded} = media_asset) do
    case MediaProcessing.process_upload(media_asset) do
      {:ok, processing_attrs} ->
        mark_media_asset_processed(media_asset, processing_attrs)

      {:error, reason} ->
        handle_processing_failure(job, media_asset, reason)
    end
  end

  defp process_media_asset(_job, %MediaAssetSchema{}), do: {:error, :invalid_media_state}

  @spec handle_processing_failure(AsyncJob.t(), MediaAssetSchema.t(), term()) ::
          LC.Infra.AsyncJobs.Handler.result()
  defp handle_processing_failure(job, media_asset, reason) do
    if terminal_attempt?(job) do
      # Terminal failures are reflected on the domain record so callers see a
      # durable media lifecycle outcome, not only queue internals.
      case mark_media_asset_failed(media_asset) do
        :ok -> {:error, reason}
        {:error, update_error} -> {:error, update_error}
      end
    else
      {:retry, reason, @default_retry_backoff_seconds}
    end
  end

  @spec mark_media_asset_processed(MediaAssetSchema.t(), map()) :: :ok | {:error, term()}
  defp mark_media_asset_processed(media_asset, processing_attrs) when is_map(processing_attrs) do
    attrs =
      processing_attrs
      |> normalize_processing_attrs()
      |> Map.put(:processing_state, :processed)

    case update_media_asset(media_asset, attrs) do
      {:ok, _updated_media_asset} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @spec mark_media_asset_failed(MediaAssetSchema.t()) :: :ok | {:error, term()}
  defp mark_media_asset_failed(media_asset) do
    case update_media_asset(media_asset, %{processing_state: :failed}) do
      {:ok, _updated_media_asset} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @spec process_webhook_event(WebhookEvent.t()) :: LC.Infra.AsyncJobs.Handler.result()
  defp process_webhook_event(%WebhookEvent{} = webhook_event) do
    case apply_webhook_payload(webhook_event.payload) do
      :ok ->
        mark_webhook_event_processed(webhook_event)

      {:drop, _reason} ->
        # Invalid callback payloads are terminal for this event record, so mark
        # it failed and ack to avoid infinite retries.
        mark_webhook_event_failed(webhook_event)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp apply_webhook_payload(payload) when is_map(payload) do
    with {:ok, event_payload} <- extract_event_payload(payload),
         {:ok, media_asset_id} <- Payload.positive_integer(event_payload, :media_asset_id),
         {:ok, processing_state} <- extract_processing_state(event_payload),
         %MediaAssetSchema{} = media_asset <- Repo.get(MediaAssetSchema, media_asset_id) do
      apply_webhook_state_update(media_asset, processing_state, event_payload)
    else
      nil -> {:drop, :media_asset_not_found}
      {:error, reason} -> {:drop, reason}
    end
  end

  @spec apply_webhook_state_update(MediaAssetSchema.t(), String.t(), webhook_payload()) ::
          :ok | {:drop, term()} | {:error, term()}
  defp apply_webhook_state_update(media_asset, "processed", event_payload) do
    metadata =
      event_payload
      |> Map.get("metadata", Map.get(event_payload, :metadata, %{}))
      |> normalize_processing_attrs()
      |> Map.put(:processing_state, :processed)

    case update_media_asset(media_asset, metadata) do
      {:ok, _updated_media_asset} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp apply_webhook_state_update(media_asset, "failed", _event_payload),
    do: mark_media_asset_failed(media_asset)

  defp apply_webhook_state_update(_media_asset, _processing_state, _event_payload),
    do: {:drop, :invalid_processing_state}

  @spec update_media_asset(MediaAssetSchema.t(), map()) ::
          {:ok, MediaAssetSchema.t()} | {:error, Ecto.Changeset.t()}
  defp update_media_asset(media_asset, attrs) do
    media_asset
    |> MediaAsset.changeset(attrs)
    |> Repo.update()
  end

  defp mark_webhook_event_processed(webhook_event) do
    case update_webhook_event(webhook_event, %{status: :processed, processed_at: utc_now()}) do
      {:ok, _updated_webhook_event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp mark_webhook_event_failed(webhook_event) do
    case update_webhook_event(webhook_event, %{status: :failed, processed_at: utc_now()}) do
      {:ok, _updated_webhook_event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @spec update_webhook_event(WebhookEvent.t(), map()) ::
          {:ok, WebhookEvent.t()} | {:error, Ecto.Changeset.t()}
  defp update_webhook_event(%WebhookEvent{} = webhook_event, attrs) do
    webhook_event
    |> cast(attrs, [:status, :processed_at])
    |> validate_required([:status])
    |> Repo.update()
  end

  defp normalize_processing_attrs(attrs) when is_map(attrs) do
    %{}
    |> maybe_put_integer_attr(attrs, :width)
    |> maybe_put_integer_attr(attrs, :height)
    |> maybe_put_integer_attr(attrs, :duration_ms)
  end

  defp maybe_put_integer_attr(acc, source, key)
       when is_map(acc) and is_map(source) and is_atom(key) do
    case Payload.value_for(source, key) do
      value when is_integer(value) -> Map.put(acc, key, value)
      _ -> acc
    end
  end

  @spec extract_event_payload(webhook_payload()) ::
          {:ok, webhook_payload()} | {:error, :invalid_payload}
  defp extract_event_payload(payload) when is_map(payload) do
    case Map.get(payload, :payload) || Map.get(payload, "payload") do
      event_payload when is_map(event_payload) -> {:ok, event_payload}
      _ -> maybe_use_payload_as_event_payload(payload)
    end
  end

  @spec maybe_use_payload_as_event_payload(webhook_payload()) ::
          {:ok, webhook_payload()} | {:error, :invalid_payload}
  defp maybe_use_payload_as_event_payload(payload) do
    case Map.get(payload, :media_asset_id) || Map.get(payload, "media_asset_id") do
      media_asset_id when is_integer(media_asset_id) and media_asset_id > 0 -> {:ok, payload}
      _ -> {:error, :invalid_payload}
    end
  end

  @spec extract_processing_state(webhook_payload()) ::
          {:ok, String.t()} | {:error, :invalid_payload}
  defp extract_processing_state(payload) when is_map(payload) do
    case Map.get(payload, :processing_state) || Map.get(payload, "processing_state") do
      processing_state when is_binary(processing_state) -> {:ok, processing_state}
      _ -> {:error, :invalid_payload}
    end
  end

  @spec terminal_attempt?(AsyncJob.t()) :: boolean()
  defp terminal_attempt?(%AsyncJob{attempts: attempts, max_attempts: max_attempts})
       when is_integer(attempts) and is_integer(max_attempts) do
    attempts >= max_attempts
  end

  defp terminal_attempt?(%AsyncJob{}), do: false

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
