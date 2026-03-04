defmodule LC.Infra.DataGovernance.Deletion do
  @moduledoc false

  import Ecto.Changeset
  import Ecto.Query, only: [from: 2]

  alias LC.Infra.{AsyncJobs, Repo}

  alias LCSchemas.Accounts.{
    AuthEvent,
    User,
    UserContactEntry,
    UserEmailAddress,
    UserIdentity,
    UserPhoneNumber,
    UserToken
  }

  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Content.{MediaAsset, Post}
  alias LCSchemas.Infra.{AccountDeletionRequest, AsyncJob}
  alias LCSchemas.Live.{LiveParticipant, LiveSession}
  alias LCSchemas.Social.{Block, Follow, Mute}

  @behaviour LC.Infra.AsyncJobs.Handler

  @job_kind "account_deletion_request"
  @default_grace_period_seconds 7 * 24 * 60 * 60
  @default_job_max_attempts 3

  @type changeset :: Ecto.Changeset.t()
  @type request_opts ::
          [{:grace_period_seconds, non_neg_integer()} | {:job_max_attempts, pos_integer()}]
  @type request_result ::
          {:ok, AccountDeletionRequest.t()} | {:error, changeset() | :enqueue_failed}
  @type cancel_error :: :not_found | :already_processing | :cannot_cancel
  @type cancel_result ::
          {:ok, AccountDeletionRequest.t()} | {:error, cancel_error() | changeset()}

  @spec request(User.t(), request_opts()) :: request_result()
  def request(%User{id: user_id}, opts \\ []) when is_integer(user_id) and user_id > 0 do
    grace_period_seconds = grace_period_seconds(opts)
    job_max_attempts = job_max_attempts(opts)
    now = utc_now()
    scheduled_purge_at = DateTime.add(now, grace_period_seconds, :second)

    user_id
    |> upsert_request_transaction(now, scheduled_purge_at, job_max_attempts)
    |> normalize_request_result()
  end

  @spec list(User.t()) :: [AccountDeletionRequest.t()]
  def list(%User{id: user_id}) when is_integer(user_id) and user_id > 0 do
    from(request in AccountDeletionRequest,
      where: request.user_id == ^user_id,
      order_by: [desc: request.inserted_at, desc: request.id]
    )
    |> Repo.all()
  end

  @spec get(User.t(), pos_integer()) :: AccountDeletionRequest.t() | nil
  def get(%User{id: user_id}, request_id)
      when is_integer(user_id) and user_id > 0 and is_integer(request_id) and request_id > 0 do
    Repo.get_by(AccountDeletionRequest, id: request_id, user_id: user_id)
  end

  @spec cancel(User.t(), pos_integer()) :: cancel_result()
  def cancel(%User{id: user_id}, request_id)
      when is_integer(user_id) and user_id > 0 and is_integer(request_id) and request_id > 0 do
    with %AccountDeletionRequest{} = request <-
           Repo.get_by(AccountDeletionRequest, id: request_id, user_id: user_id),
         :ok <- ensure_cancelable(request),
         {:ok, canceled_request} <-
           update_request(request, %{
             status: :canceled,
             completed_at: utc_now(),
             failure_reason: nil
           }) do
      # Canceled requests may still have queued jobs; remove pending rows here
      # so the queue does not spend capacity no-oping canceled work later.
      :ok = cancel_pending_job(request_id)

      :ok =
        persist_auth_event(:account_deletion_canceled, user_id, %{
          "account_deletion_request_id" => request_id
        })

      {:ok, canceled_request}
    else
      nil -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl LC.Infra.AsyncJobs.Handler
  @spec handle(AsyncJob.t()) :: LC.Infra.AsyncJobs.Handler.result()
  def handle(%AsyncJob{kind: @job_kind, payload: payload}) when is_map(payload) do
    with {:ok, request_id} <- extract_payload_integer(payload, :account_deletion_request_id),
         %AccountDeletionRequest{} = request <- Repo.get(AccountDeletionRequest, request_id) do
      process_request(request)
    else
      nil ->
        # Missing rows are treated as already-processed so retries can drain.
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  def handle(%AsyncJob{kind: @job_kind}), do: {:error, :invalid_payload}
  def handle(%AsyncJob{}), do: {:error, :unsupported_job_kind}

  @spec upsert_request_transaction(pos_integer(), DateTime.t(), DateTime.t(), pos_integer()) ::
          {:ok, {:created | :existing, AccountDeletionRequest.t()}}
          | {:error, changeset() | :enqueue_failed}
  defp upsert_request_transaction(user_id, now, scheduled_purge_at, job_max_attempts) do
    Repo.transact(fn ->
      case get_active_request(user_id) do
        %AccountDeletionRequest{} = existing_request ->
          {:ok, {:existing, existing_request}}

        nil ->
          with {:ok, request} <- insert_request(user_id, now, scheduled_purge_at),
               {:ok, _job} <- enqueue_request(request, scheduled_purge_at, job_max_attempts) do
            {:ok, {:created, request}}
          else
            {:error, reason} -> {:error, reason}
          end
      end
    end)
  end

  @spec normalize_request_result(
          {:ok, {:created | :existing, AccountDeletionRequest.t()}}
          | {:error, changeset() | :enqueue_failed}
        ) :: request_result()
  defp normalize_request_result({:ok, {:existing, %AccountDeletionRequest{} = request}}),
    do: {:ok, request}

  defp normalize_request_result({:ok, {:created, %AccountDeletionRequest{} = request}}) do
    :ok =
      persist_auth_event(:account_deletion_requested, request.user_id, %{
        "account_deletion_request_id" => request.id,
        "scheduled_purge_at" => DateTime.to_iso8601(request.scheduled_purge_at)
      })

    {:ok, request}
  end

  defp normalize_request_result({:error, reason}), do: {:error, reason}

  @spec get_active_request(pos_integer()) :: AccountDeletionRequest.t() | nil
  defp get_active_request(user_id) when is_integer(user_id) and user_id > 0 do
    from(request in AccountDeletionRequest,
      where:
        request.user_id == ^user_id and request.status in [:pending, :scheduled, :processing],
      order_by: [desc: request.inserted_at, desc: request.id],
      limit: 1
    )
    |> Repo.one()
  end

  @spec insert_request(pos_integer(), DateTime.t(), DateTime.t()) ::
          {:ok, AccountDeletionRequest.t()} | {:error, changeset()}
  defp insert_request(user_id, requested_at, scheduled_purge_at) do
    %AccountDeletionRequest{}
    |> request_changeset(%{
      user_id: user_id,
      status: :scheduled,
      requested_at: requested_at,
      scheduled_purge_at: scheduled_purge_at
    })
    |> Repo.insert()
  end

  @spec enqueue_request(AccountDeletionRequest.t(), DateTime.t(), pos_integer()) ::
          {:ok, AsyncJob.t()} | {:error, :enqueue_failed}
  defp enqueue_request(
         %AccountDeletionRequest{id: request_id},
         scheduled_purge_at,
         job_max_attempts
       )
       when is_integer(request_id) and request_id > 0 and is_integer(job_max_attempts) and
              job_max_attempts > 0 do
    case AsyncJobs.enqueue(
           @job_kind,
           %{account_deletion_request_id: request_id},
           dedupe_key: "account_deletion_request:#{request_id}",
           scheduled_at: scheduled_purge_at,
           max_attempts: job_max_attempts
         ) do
      {:ok, %AsyncJob{} = job} ->
        {:ok, job}

      {:error, _reason} ->
        {:error, :enqueue_failed}
    end
  end

  @spec ensure_cancelable(AccountDeletionRequest.t()) :: :ok | {:error, cancel_error()}
  defp ensure_cancelable(%AccountDeletionRequest{status: status})
       when status in [:pending, :scheduled],
       do: :ok

  defp ensure_cancelable(%AccountDeletionRequest{status: :processing}),
    do: {:error, :already_processing}

  defp ensure_cancelable(%AccountDeletionRequest{}),
    do: {:error, :cannot_cancel}

  @spec cancel_pending_job(pos_integer()) :: :ok
  defp cancel_pending_job(request_id) when is_integer(request_id) and request_id > 0 do
    # Only pending rows are deleted. If a worker already claimed the job, the
    # handler-level canceled-state guard keeps execution idempotent.
    from(job in AsyncJob,
      where:
        job.kind == ^@job_kind and job.dedupe_key == ^"account_deletion_request:#{request_id}" and
          job.status == :pending
    )
    |> Repo.delete_all()

    :ok
  end

  @spec process_request(AccountDeletionRequest.t()) :: LC.Infra.AsyncJobs.Handler.result()
  defp process_request(%AccountDeletionRequest{status: status})
       when status in [:completed, :canceled],
       do: :ok

  defp process_request(%AccountDeletionRequest{status: :failed}), do: :ok

  defp process_request(%AccountDeletionRequest{} = request) do
    now = utc_now()

    cond do
      not purge_due?(request, now) ->
        {:retry, :grace_period_not_elapsed, seconds_until_purge(request, now)}

      true ->
        execute_deletion(request)
    end
  end

  @spec purge_due?(AccountDeletionRequest.t(), DateTime.t()) :: boolean()
  defp purge_due?(%AccountDeletionRequest{scheduled_purge_at: scheduled_purge_at}, now)
       when is_struct(scheduled_purge_at, DateTime) and is_struct(now, DateTime),
       do: DateTime.compare(scheduled_purge_at, now) in [:lt, :eq]

  defp purge_due?(%AccountDeletionRequest{}, _now), do: false

  @spec seconds_until_purge(AccountDeletionRequest.t(), DateTime.t()) :: non_neg_integer()
  defp seconds_until_purge(
         %AccountDeletionRequest{scheduled_purge_at: %DateTime{} = scheduled},
         now
       ) do
    DateTime.diff(scheduled, now, :second)
    |> max(0)
  end

  defp seconds_until_purge(%AccountDeletionRequest{}, _now), do: 60

  @spec execute_deletion(AccountDeletionRequest.t()) :: LC.Infra.AsyncJobs.Handler.result()
  defp execute_deletion(%AccountDeletionRequest{} = request) do
    with {:ok, processing_request} <-
           update_request(request, %{
             status: :processing,
             completed_at: nil,
             failure_reason: nil
           }),
         :ok <- purge_user_records(processing_request.user_id),
         {:ok, _completed_request} <-
           update_request(processing_request, %{
             status: :completed,
             completed_at: utc_now(),
             failure_reason: nil
           }) do
      :ok =
        persist_auth_event(:account_deletion_completed, processing_request.user_id, %{
          "account_deletion_request_id" => processing_request.id
        })

      :ok
    else
      {:error, reason} ->
        handle_failed_request(request, reason)
    end
  end

  @spec handle_failed_request(AccountDeletionRequest.t(), term()) :: {:error, :deletion_failed}
  defp handle_failed_request(%AccountDeletionRequest{} = request, reason) do
    failure_reason = sanitize_failure_reason(reason)

    _ =
      update_request(request, %{
        status: :failed,
        completed_at: utc_now(),
        failure_reason: failure_reason
      })

    :ok =
      persist_auth_event(:account_deletion_failed, request.user_id, %{
        "account_deletion_request_id" => request.id,
        "reason" => failure_reason
      })

    {:error, :deletion_failed}
  end

  @spec purge_user_records(pos_integer() | nil) :: :ok | {:error, String.t()}
  defp purge_user_records(user_id) when is_integer(user_id) and user_id > 0 do
    try do
      {:ok, :ok} =
        Repo.transact(fn ->
          # Keep purge order explicit so retries are deterministic and the
          # workflow behavior remains stable as schema relationships evolve.
          _ = delete_user_chat_messages(user_id)
          _ = delete_user_live_participants(user_id)
          _ = delete_user_live_sessions(user_id)
          _ = delete_user_media_assets(user_id)
          _ = delete_user_posts(user_id)
          _ = delete_social_edges(user_id)
          _ = delete_user_contact_entries(user_id)
          _ = delete_user_identities(user_id)
          _ = delete_user_phone_links(user_id)
          _ = delete_user_email_links(user_id)
          _ = delete_user_tokens(user_id)
          _ = delete_user(user_id)
          {:ok, :ok}
        end)

      :ok
    rescue
      exception ->
        {:error, Exception.message(exception)}
    end
  end

  defp purge_user_records(_user_id), do: :ok

  @spec delete_user_chat_messages(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_chat_messages(user_id) do
    from(chat_message in ChatMessage, where: chat_message.sender_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_live_participants(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_live_participants(user_id) do
    from(live_participant in LiveParticipant, where: live_participant.user_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_live_sessions(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_live_sessions(user_id) do
    from(live_session in LiveSession, where: live_session.host_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_media_assets(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_media_assets(user_id) do
    from(media_asset in MediaAsset, where: media_asset.owner_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_posts(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_posts(user_id) do
    from(post in Post, where: post.author_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_social_edges(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_social_edges(user_id) do
    _ =
      from(follow in Follow,
        where: follow.follower_id == ^user_id or follow.followed_id == ^user_id
      )
      |> Repo.delete_all()

    _ =
      from(block in Block,
        where: block.blocker_id == ^user_id or block.blocked_id == ^user_id
      )
      |> Repo.delete_all()

    from(mute in Mute, where: mute.muter_id == ^user_id or mute.muted_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_contact_entries(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_contact_entries(user_id) do
    from(user_contact_entry in UserContactEntry, where: user_contact_entry.user_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_identities(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_identities(user_id) do
    from(user_identity in UserIdentity, where: user_identity.user_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_phone_links(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_phone_links(user_id) do
    from(user_phone_number in UserPhoneNumber, where: user_phone_number.user_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_email_links(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_email_links(user_id) do
    from(user_email_address in UserEmailAddress, where: user_email_address.user_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user_tokens(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user_tokens(user_id) do
    from(user_token in UserToken, where: user_token.user_id == ^user_id)
    |> Repo.delete_all()
  end

  @spec delete_user(pos_integer()) :: {non_neg_integer(), nil | [term()]}
  defp delete_user(user_id) do
    from(user in User, where: user.id == ^user_id)
    |> Repo.delete_all()
  end

  @spec update_request(AccountDeletionRequest.t(), map()) ::
          {:ok, AccountDeletionRequest.t()} | {:error, changeset()}
  defp update_request(%AccountDeletionRequest{} = request, attrs) when is_map(attrs) do
    request
    |> request_changeset(attrs)
    |> Repo.update()
  end

  @spec request_changeset(AccountDeletionRequest.t(), map()) :: changeset()
  defp request_changeset(%AccountDeletionRequest{} = request, attrs) when is_map(attrs) do
    request
    |> cast(attrs, [
      :user_id,
      :status,
      :requested_at,
      :scheduled_purge_at,
      :completed_at,
      :failure_reason
    ])
    |> validate_required([:status, :requested_at, :scheduled_purge_at])
    |> unique_constraint(:entropy_id)
  end

  defp persist_auth_event(event_type, user_id, metadata)
       when is_atom(event_type) and is_map(metadata) do
    attrs = %{event_type: event_type, user_id: user_id, metadata: metadata}

    case insert_auth_event(attrs) do
      {:ok, _event} ->
        :ok

      {:error, _changeset} ->
        # Deletion completion can happen after user row removal. Fallback to an
        # anonymous event with user ID preserved in sanitized metadata.
        _ =
          insert_auth_event(%{
            event_type: event_type,
            user_id: nil,
            metadata: Map.put_new(metadata, "user_id", user_id)
          })

        :ok
    end
  end

  @spec insert_auth_event(%{
          required(:event_type) => LCSchemas.Accounts.auth_event_type(),
          optional(:user_id) => pos_integer() | nil,
          optional(:metadata) => map()
        }) :: {:ok, AuthEvent.t()} | {:error, changeset()}
  defp insert_auth_event(attrs) when is_map(attrs) do
    %AuthEvent{}
    |> cast(attrs, [:event_type, :user_id, :metadata])
    |> validate_required([:event_type])
    |> validate_change(:metadata, fn :metadata, metadata ->
      if is_map(metadata), do: [], else: [metadata: "must be a map"]
    end)
    |> foreign_key_constraint(:user_id)
    |> Repo.insert()
  end

  defp sanitize_failure_reason(reason) when is_binary(reason), do: String.slice(reason, 0, 250)
  defp sanitize_failure_reason(reason), do: reason |> inspect(limit: 50) |> String.slice(0, 250)

  @spec extract_payload_integer(map(), :account_deletion_request_id) ::
          {:ok, pos_integer()} | {:error, :invalid_payload}
  defp extract_payload_integer(payload, key) when is_map(payload) and is_atom(key) do
    case Map.get(payload, key) || Map.get(payload, Atom.to_string(key)) do
      value when is_integer(value) and value > 0 -> {:ok, value}
      _ -> {:error, :invalid_payload}
    end
  end

  @spec grace_period_seconds(request_opts()) :: non_neg_integer()
  defp grace_period_seconds(opts) do
    opts
    |> Keyword.get(
      :grace_period_seconds,
      config_value(:grace_period_seconds, @default_grace_period_seconds)
    )
    |> ensure_non_negative_integer(@default_grace_period_seconds)
  end

  @spec job_max_attempts(request_opts()) :: pos_integer()
  defp job_max_attempts(opts) do
    opts
    |> Keyword.get(:job_max_attempts, config_value(:job_max_attempts, @default_job_max_attempts))
    |> ensure_positive_integer(@default_job_max_attempts)
  end

  defp config_value(key, default) when is_atom(key) do
    __MODULE__
    |> Application.get_env(:live_canvas, [])
    |> Keyword.get(key, default)
  end

  defp ensure_positive_integer(value, _default) when is_integer(value) and value > 0, do: value
  defp ensure_positive_integer(_value, default), do: default

  defp ensure_non_negative_integer(value, _default) when is_integer(value) and value >= 0,
    do: value

  defp ensure_non_negative_integer(_value, default), do: default

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
