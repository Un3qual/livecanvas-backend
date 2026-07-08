defmodule LC.Content do
  @moduledoc """
  The Content context.
  """

  use Boundary, deps: [LC.Accounts, LC.Authz, LC.Infra, LCPayload, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.Accounts.Scope
  alias LC.Authz.Policy
  alias LC.Content.{MediaAsset, Post, PostReport}
  alias LC.Infra.{AsyncJobs, ObjectStorage, Repo, WebhookEvent}
  alias LCPayload.Payload
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema
  alias LCSchemas.Content.Post, as: PostSchema
  alias LCSchemas.Content.PostReport, as: PostReportSchema
  alias LCSchemas.Infra.WebhookEvent, as: WebhookEventSchema

  @type changeset :: Ecto.Changeset.t()
  @type post_result :: {:ok, PostSchema.t()} | {:error, changeset()}
  @type post_update_result :: {:ok, PostSchema.t()} | {:error, changeset() | :not_found}
  @type post_delete_result :: {:ok, PostSchema.t()} | {:error, changeset() | :not_found}
  @type post_report_result ::
          {:ok, PostReportSchema.t()} | {:error, changeset() | :not_found | :own_post}
  @type post_report_query_result :: {:ok, Ecto.Query.t()} | {:error, :not_authorized}
  @type post_report_moderation_fetch_result ::
          {:ok, PostReportSchema.t()} | {:error, :not_authorized | :not_found}
  @type post_report_decision_result ::
          {:ok, PostReportSchema.t()}
          | {:error,
             changeset() | :invalid_status | :invalid_transition | :not_authorized | :not_found}
  @type post_report_decision_attrs :: %{
          optional(:status | :decision_note | String.t()) => term()
        }
  @type media_asset_result :: {:ok, MediaAssetSchema.t()} | {:error, changeset()}
  @type live_recording_media_asset_opts :: [lock: :for_update]
  @type live_recording_media_asset_result ::
          {:ok, MediaAssetSchema.t()} | {:error, :invalid_processing_state | :not_found}
  @type media_upload_result ::
          {:ok, %{media_asset: MediaAssetSchema.t(), upload: ObjectStorage.signed_upload()}}
          | {:error, changeset() | :invalid_upload_request | term()}
  @type media_asset_public_url_result :: {:ok, String.t()} | {:error, term()}
  @type media_finalize_result :: {:ok, MediaAssetSchema.t()} | {:error, changeset() | atom()}
  @type webhook_ingest_result ::
          {:ok, :accepted | :duplicate}
          | {:error, :enqueue_failed | :invalid_payload | Ecto.Changeset.t()}
  @type attachable_post_media_assets_result ::
          {:ok, [MediaAssetSchema.t()]} | {:error, Ecto.Changeset.t()}
  @media_processing_job_kind "media_asset_processing"
  @media_processing_job_max_attempts 2
  @post_report_statuses [:open, :reviewed, :dismissed, :actioned]
  @post_media_asset_error "must reference viewer-owned uploaded or processed assets"

  @doc """
  Persists a post owned by the given author.
  """
  @spec create_post(User.t(), map()) :: post_result()
  def create_post(%User{id: author_id}, attrs) when is_map(attrs) do
    post_changeset =
      %PostSchema{}
      |> Post.changeset(Post.attrs_for_insert(author_id, attrs))

    with {:ok, media_asset_ids} <- normalize_media_asset_ids(attrs, post_changeset),
         true <- post_changeset.valid? || {:error, post_changeset} do
      Repo.transaction(fn ->
        with {:ok, media_assets} <-
               fetch_attachable_post_media_assets(author_id, media_asset_ids, post_changeset),
             {:ok, post} <- Repo.insert(post_changeset),
             {:ok, _attached_assets} <- attach_post_media_assets(post, media_assets) do
          post
        else
          {:error, %Ecto.Changeset{} = changeset} ->
            Repo.rollback(changeset)
        end
      end)
      |> normalize_create_post_result()
    end
  end

  @doc """
  Updates a viewer-owned post by local post ID.
  """
  @spec update_user_post(User.t(), pos_integer(), map()) :: post_update_result()
  def update_user_post(%User{id: author_id}, post_id, attrs)
      when is_integer(post_id) and post_id > 0 and is_map(attrs) do
    case get_user_post(author_id, post_id) do
      nil ->
        {:error, :not_found}

      %PostSchema{} = post ->
        post
        |> Post.update_changeset(attrs)
        |> Repo.update()
    end
  end

  def update_user_post(%User{}, _post_id, _attrs), do: {:error, :not_found}

  @doc """
  Deletes a viewer-owned post by local post ID.
  """
  @spec delete_user_post(User.t(), pos_integer()) :: post_delete_result()
  def delete_user_post(%User{id: author_id}, post_id)
      when is_integer(post_id) and post_id > 0 do
    case get_user_post(author_id, post_id) do
      nil -> {:error, :not_found}
      %PostSchema{} = post -> Repo.delete(post)
    end
  end

  def delete_user_post(%User{}, _post_id), do: {:error, :not_found}

  @doc """
  Reports a visible post on behalf of the viewer.
  """
  @spec report_post(User.t(), PostSchema.t() | nil, map()) :: post_report_result()
  def report_post(%User{id: reporter_id}, %PostSchema{author_id: reporter_id}, _attrs) do
    {:error, :own_post}
  end

  def report_post(%User{id: reporter_id}, %PostSchema{id: post_id}, attrs)
      when is_integer(reporter_id) and is_integer(post_id) and post_id > 0 and is_map(attrs) do
    changeset =
      %PostReportSchema{}
      |> PostReport.changeset(PostReport.attrs_for_insert(reporter_id, post_id, attrs))

    case Repo.insert(changeset) do
      {:ok, report} ->
        {:ok, report}

      {:error, %Ecto.Changeset{} = changeset} ->
        handle_post_report_insert_error(changeset, reporter_id, post_id)
    end
  end

  def report_post(%User{}, _post, _attrs), do: {:error, :not_found}

  @doc """
  Gets a post report by ID when it belongs to the viewer.
  """
  @spec get_user_post_report(User.t(), integer()) :: PostReportSchema.t() | nil
  def get_user_post_report(%User{id: reporter_id}, report_id)
      when is_integer(report_id) do
    Repo.get_by(PostReportSchema, id: report_id, reporter_id: reporter_id)
  end

  def get_user_post_report(%User{}, _report_id), do: nil

  @doc """
  Returns a staff-authorized query for the moderation report queue.
  """
  @spec list_post_reports_for_moderation(Scope.t() | nil, keyword() | map()) ::
          post_report_query_result()
  def list_post_reports_for_moderation(scope, opts \\ []) do
    with :ok <- authorize_post_report_moderation(scope) do
      {:ok, post_reports_for_moderation_query(opts)}
    end
  end

  @doc """
  Gets a post report by ID for staff moderation.
  """
  @spec get_moderation_post_report(Scope.t() | nil, integer()) ::
          post_report_moderation_fetch_result()
  def get_moderation_post_report(scope, report_id)
      when is_integer(report_id) do
    with :ok <- authorize_post_report_moderation(scope) do
      case Repo.get(PostReportSchema, report_id) do
        %PostReportSchema{} = report -> {:ok, report}
        nil -> {:error, :not_found}
      end
    end
  end

  @doc """
  Records a staff decision for a post report.
  """
  @spec decide_post_report(Scope.t() | nil, integer(), post_report_decision_attrs()) ::
          post_report_decision_result()
  def decide_post_report(%Scope{user: %User{id: reviewer_id}} = scope, report_id, attrs)
      when is_integer(reviewer_id) and is_integer(report_id) and is_map(attrs) do
    with :ok <- authorize_post_report_moderation(scope) do
      Repo.transaction(fn ->
        report_id
        |> locked_post_report_query()
        |> Repo.one()
        |> update_locked_post_report_decision(reviewer_id, attrs)
      end)
      |> case do
        {:ok, %PostReportSchema{} = report} -> {:ok, report}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  def decide_post_report(_scope, _report_id, _attrs), do: {:error, :not_authorized}

  @doc false
  @spec run_query(Ecto.Query.t()) :: [term()]
  def run_query(query), do: Repo.all(query)

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

  @spec get_user_post(pos_integer(), pos_integer()) :: PostSchema.t() | nil
  defp get_user_post(author_id, post_id)
       when is_integer(author_id) and is_integer(post_id) and post_id > 0 do
    # Ownership is enforced in the lookup query so update/delete calls cannot
    # mutate posts across account boundaries.
    Repo.get_by(PostSchema, id: post_id, author_id: author_id)
  end

  @spec authorize_post_report_moderation(Scope.t() | nil) :: :ok | {:error, :not_authorized}
  defp authorize_post_report_moderation(scope) do
    Policy.authorize(:scope_post_report_moderation, scope, nil)
  end

  @spec post_reports_for_moderation_query(keyword() | map()) :: Ecto.Query.t()
  defp post_reports_for_moderation_query(opts) do
    from(post_report in PostReportSchema,
      order_by: [
        asc:
          fragment(
            "CASE ? WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 WHEN 'dismissed' THEN 2 WHEN 'actioned' THEN 3 ELSE 4 END",
            post_report.status
          ),
        asc: post_report.inserted_at,
        asc: post_report.id
      ]
    )
    |> maybe_filter_post_report_status(option_value(opts, :status))
  end

  @spec maybe_filter_post_report_status(Ecto.Query.t(), term()) :: Ecto.Query.t()
  defp maybe_filter_post_report_status(query, status) when status in @post_report_statuses do
    where(query, [post_report], post_report.status == ^status)
  end

  defp maybe_filter_post_report_status(query, _status), do: query

  @spec locked_post_report_query(integer()) :: Ecto.Query.t()
  defp locked_post_report_query(report_id) when is_integer(report_id) do
    from(post_report in PostReportSchema,
      where: post_report.id == ^report_id,
      lock: "FOR UPDATE"
    )
  end

  @spec update_locked_post_report_decision(PostReportSchema.t() | nil, pos_integer(), map()) ::
          PostReportSchema.t() | no_return()
  defp update_locked_post_report_decision(nil, _reviewer_id, _attrs),
    do: Repo.rollback(:not_found)

  defp update_locked_post_report_decision(%PostReportSchema{} = report, reviewer_id, attrs)
       when is_integer(reviewer_id) and is_map(attrs) do
    with {:ok, status} <- decision_status(attrs),
         :ok <- validate_post_report_decision_transition(report.status, status) do
      report
      |> PostReport.decision_changeset(decision_attrs(attrs, reviewer_id, status))
      |> Repo.update()
      |> case do
        {:ok, updated_report} -> updated_report
        {:error, %Ecto.Changeset{} = changeset} -> Repo.rollback(changeset)
      end
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  @spec decision_status(map()) ::
          {:ok, LCSchemas.Content.post_report_status()} | {:error, :invalid_status}
  defp decision_status(attrs) when is_map(attrs) do
    case option_value(attrs, :status) do
      status when status in @post_report_statuses -> {:ok, status}
      status when is_binary(status) -> string_post_report_status(status)
      _other -> {:error, :invalid_status}
    end
  end

  @spec string_post_report_status(String.t()) ::
          {:ok, LCSchemas.Content.post_report_status()} | {:error, :invalid_status}
  defp string_post_report_status(status) when is_binary(status) do
    normalized_status =
      status
      |> String.trim()
      |> String.downcase()
      |> String.to_existing_atom()

    if normalized_status in @post_report_statuses do
      {:ok, normalized_status}
    else
      {:error, :invalid_status}
    end
  rescue
    ArgumentError -> {:error, :invalid_status}
  end

  @spec decision_attrs(map(), pos_integer(), LCSchemas.Content.post_report_status()) :: map()
  defp decision_attrs(attrs, reviewer_id, status) when is_map(attrs) do
    %{
      status: status,
      decision_note: option_value(attrs, :decision_note),
      reviewed_by_id: reviewer_id,
      reviewed_at: now_utc()
    }
  end

  @spec validate_post_report_decision_transition(
          LCSchemas.Content.post_report_status(),
          LCSchemas.Content.post_report_status()
        ) :: :ok | {:error, :invalid_transition}
  defp validate_post_report_decision_transition(:open, status)
       when status in [:reviewed, :dismissed, :actioned],
       do: :ok

  defp validate_post_report_decision_transition(:reviewed, status)
       when status in [:dismissed, :actioned],
       do: :ok

  defp validate_post_report_decision_transition(_current_status, _next_status),
    do: {:error, :invalid_transition}

  defp option_value(opts, key) when is_list(opts) and is_atom(key), do: Keyword.get(opts, key)

  defp option_value(opts, key) when is_map(opts) and is_atom(key) do
    case Map.fetch(opts, key) do
      {:ok, value} -> value
      :error -> Map.get(opts, Atom.to_string(key))
    end
  end

  @spec handle_post_report_insert_error(Ecto.Changeset.t(), pos_integer(), pos_integer()) ::
          post_report_result()
  defp handle_post_report_insert_error(changeset, reporter_id, post_id)
       when is_integer(reporter_id) and is_integer(post_id) do
    if unique_post_report_conflict?(changeset) do
      {:ok, Repo.get_by!(PostReportSchema, reporter_id: reporter_id, post_id: post_id)}
    else
      {:error, changeset}
    end
  end

  @spec unique_post_report_conflict?(Ecto.Changeset.t()) :: boolean()
  defp unique_post_report_conflict?(%Ecto.Changeset{errors: errors}) do
    Enum.any?(errors, fn
      {:reporter_id,
       {_message, constraint: :unique, constraint_name: "post_reports_reporter_id_post_id_index"}} ->
        true

      _error ->
        false
    end)
  end

  @doc """
  Gets a media asset by ID when owned by the provided viewer.
  """
  @spec get_user_media_asset(User.t(), integer()) :: MediaAssetSchema.t() | nil
  def get_user_media_asset(%User{id: owner_id}, media_asset_id)
      when is_integer(media_asset_id) do
    Repo.get_by(MediaAssetSchema, id: media_asset_id, owner_id: owner_id)
  end

  @doc """
  Gets a durable media asset that is safe to expose from an ended live session.
  """
  @spec get_live_recording_media_asset(pos_integer()) :: MediaAssetSchema.t() | nil
  def get_live_recording_media_asset(media_asset_id)
      when is_integer(media_asset_id) and media_asset_id > 0 do
    from(media_asset in MediaAssetSchema,
      where:
        media_asset.id == ^media_asset_id and
          media_asset.processing_state in [:uploaded, :processed]
    )
    |> Repo.one()
  end

  def get_live_recording_media_asset(_media_asset_id), do: nil

  @doc """
  Fetches an owner-owned media asset that is durable enough to link as a live recording.
  """
  @spec fetch_live_recording_media_asset(
          pos_integer(),
          pos_integer(),
          live_recording_media_asset_opts()
        ) ::
          live_recording_media_asset_result()
  def fetch_live_recording_media_asset(owner_id, media_asset_id, opts \\ [])

  def fetch_live_recording_media_asset(owner_id, media_asset_id, opts)
      when is_integer(owner_id) and owner_id > 0 and is_integer(media_asset_id) and
             media_asset_id > 0 and is_list(opts) do
    query =
      from(media_asset in MediaAssetSchema,
        where: media_asset.id == ^media_asset_id and media_asset.owner_id == ^owner_id
      )
      |> maybe_lock_live_recording_query(Keyword.get(opts, :lock))

    case Repo.one(query) do
      %MediaAssetSchema{processing_state: processing_state} = media_asset
      when processing_state in [:uploaded, :processed] ->
        {:ok, media_asset}

      %MediaAssetSchema{} ->
        # Ended sessions must not point at recordings that are still missing
        # upload data or have already failed terminal processing.
        {:error, :invalid_processing_state}

      nil ->
        {:error, :not_found}
    end
  end

  def fetch_live_recording_media_asset(_owner_id, _media_asset_id, _opts),
    do: {:error, :not_found}

  @doc """
  Returns the canonical public serving URL for a persisted media asset.
  """
  @spec media_asset_public_url(MediaAssetSchema.t()) :: media_asset_public_url_result()
  def media_asset_public_url(%MediaAssetSchema{storage_key: storage_key})
      when is_binary(storage_key) do
    ObjectStorage.public_asset_url(storage_key)
  end

  def media_asset_public_url(%MediaAssetSchema{}), do: {:error, :invalid_storage_key}

  @doc """
  Finalizes a pending upload for the owner and enqueues async media processing.
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
        enqueue_media_processing(media_asset)

      %MediaAssetSchema{processing_state: :failed} ->
        {:error, :processing_failed}

      %MediaAssetSchema{processing_state: :pending_upload} = media_asset ->
        finalize_pending_upload(media_asset, attrs)
    end
  end

  @spec finalize_pending_upload(MediaAssetSchema.t(), map()) :: media_finalize_result()
  defp finalize_pending_upload(media_asset, attrs) do
    with {:ok, uploaded_asset} <-
           update_media_asset(media_asset, Map.put(attrs, :processing_state, :uploaded)),
         {:ok, _queued_asset} <- enqueue_media_processing(uploaded_asset) do
      {:ok, uploaded_asset}
    end
  end

  @spec enqueue_media_processing(MediaAssetSchema.t()) :: media_finalize_result()
  defp enqueue_media_processing(%MediaAssetSchema{id: media_asset_id} = uploaded_asset)
       when is_integer(media_asset_id) and media_asset_id > 0 do
    # Enqueue uses a stable dedupe key so repeated finalize calls remain
    # idempotent while still guaranteeing processing is durably scheduled.
    case AsyncJobs.enqueue(
           @media_processing_job_kind,
           %{media_asset_id: media_asset_id},
           dedupe_key: "media_asset_processing:#{media_asset_id}",
           max_attempts: @media_processing_job_max_attempts
         ) do
      {:ok, _job} -> {:ok, uploaded_asset}
      {:error, _reason} -> {:error, :enqueue_failed}
    end
  end

  @spec normalize_media_asset_ids(map(), Ecto.Changeset.t()) ::
          {:ok, [pos_integer()]} | {:error, Ecto.Changeset.t()}
  defp normalize_media_asset_ids(attrs, %Ecto.Changeset{} = post_changeset) when is_map(attrs) do
    case Payload.value_for(attrs, :media_asset_ids) do
      nil ->
        {:ok, []}

      media_asset_ids when is_list(media_asset_ids) ->
        if Enum.all?(media_asset_ids, &(is_integer(&1) and &1 > 0)) do
          {:ok, Enum.uniq(media_asset_ids)}
        else
          {:error,
           Ecto.Changeset.add_error(
             post_changeset,
             :media_asset_ids,
             "must be a list of positive ids"
           )}
        end

      _invalid_media_asset_ids ->
        {:error,
         Ecto.Changeset.add_error(
           post_changeset,
           :media_asset_ids,
           "must be a list of positive ids"
         )}
    end
  end

  @spec fetch_attachable_post_media_assets(pos_integer(), [pos_integer()], Ecto.Changeset.t()) ::
          attachable_post_media_assets_result()
  defp fetch_attachable_post_media_assets(_author_id, [], %Ecto.Changeset{}), do: {:ok, []}

  defp fetch_attachable_post_media_assets(
         author_id,
         media_asset_ids,
         %Ecto.Changeset{} = post_changeset
       )
       when is_integer(author_id) and author_id > 0 and is_list(media_asset_ids) do
    media_assets =
      from(media_asset in MediaAssetSchema,
        where: media_asset.id in ^media_asset_ids and media_asset.owner_id == ^author_id,
        lock: "FOR UPDATE"
      )
      |> Repo.all()

    if attachable_post_media_assets?(media_assets, media_asset_ids) do
      {:ok, media_assets}
    else
      {:error,
       Ecto.Changeset.add_error(post_changeset, :media_asset_ids, @post_media_asset_error)}
    end
  end

  @spec attachable_post_media_assets?([MediaAssetSchema.t()], [pos_integer()]) :: boolean()
  defp attachable_post_media_assets?(media_assets, media_asset_ids)
       when is_list(media_assets) and is_list(media_asset_ids) do
    loaded_ids = media_assets |> Enum.map(& &1.id) |> Enum.sort()
    requested_ids = Enum.sort(media_asset_ids)

    loaded_ids == requested_ids and
      Enum.all?(media_assets, &attachable_post_media_asset?/1)
  end

  @spec attachable_post_media_asset?(MediaAssetSchema.t()) :: boolean()
  defp attachable_post_media_asset?(%MediaAssetSchema{
         post_id: nil,
         processing_state: processing_state
       })
       when processing_state in [:uploaded, :processed],
       do: true

  defp attachable_post_media_asset?(%MediaAssetSchema{}), do: false

  @spec attach_post_media_assets(PostSchema.t(), [MediaAssetSchema.t()]) ::
          {:ok, [MediaAssetSchema.t()]} | {:error, Ecto.Changeset.t()}
  defp attach_post_media_assets(%PostSchema{}, []), do: {:ok, []}

  defp attach_post_media_assets(%PostSchema{id: post_id}, media_assets)
       when is_integer(post_id) and post_id > 0 and is_list(media_assets) do
    Enum.reduce_while(media_assets, {:ok, []}, fn media_asset, {:ok, attached_assets} ->
      case media_asset
           |> MediaAsset.changeset(%{post_id: post_id})
           |> Repo.update() do
        {:ok, attached_asset} ->
          {:cont, {:ok, [attached_asset | attached_assets]}}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:halt, {:error, changeset}}
      end
    end)
  end

  @spec normalize_create_post_result({:ok, PostSchema.t()} | {:error, Ecto.Changeset.t()}) ::
          post_result()
  defp normalize_create_post_result({:ok, %PostSchema{} = post}), do: {:ok, post}

  defp normalize_create_post_result({:error, %Ecto.Changeset{} = changeset}),
    do: {:error, changeset}

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
    Payload.value_for(attrs, :mime_type)
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

  @spec maybe_lock_live_recording_query(Ecto.Query.t(), :for_update | nil) :: Ecto.Query.t()
  defp maybe_lock_live_recording_query(query, nil), do: query

  defp maybe_lock_live_recording_query(query, :for_update) do
    from(media_asset in query, lock: "FOR UPDATE")
  end

  @spec now_utc() :: DateTime.t()
  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
