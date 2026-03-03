defmodule LC.Infra.AsyncJobs do
  @moduledoc false

  import Ecto.Changeset
  import Ecto.Query

  alias LC.Infra.Repo
  alias LCSchemas.Infra.AsyncJob, as: AsyncJobSchema

  @type changeset :: Ecto.Changeset.t()
  @type enqueue_opts :: [
          {:dedupe_key, String.t()}
          | {:scheduled_at, DateTime.t()}
          | {:max_attempts, pos_integer()}
        ]
  @type job_result :: {:ok, AsyncJobSchema.t()} | {:error, changeset() | :not_found}

  @doc """
  Inserts a new async job and treats duplicate dedupe keys as idempotent retries.
  """
  @spec enqueue(String.t(), map(), enqueue_opts()) :: job_result()
  def enqueue(kind, payload, opts \\ [])
      when is_binary(kind) and is_map(payload) and is_list(opts) do
    dedupe_key = Keyword.get(opts, :dedupe_key)

    with nil <- maybe_get_existing_by_dedupe_key(dedupe_key),
         {:ok, job} <- insert_job(kind, payload, opts) do
      {:ok, job}
    else
      %AsyncJobSchema{} = existing_job ->
        {:ok, existing_job}

      {:error, %Ecto.Changeset{} = changeset} ->
        maybe_resolve_dedupe_conflict(changeset, dedupe_key)
    end
  end

  @doc """
  Atomically claims due jobs for a given kind using `FOR UPDATE SKIP LOCKED`.
  """
  @spec claim_due_jobs(String.t(), pos_integer()) :: [AsyncJobSchema.t()]
  def claim_due_jobs(kind, limit \\ 10)
      when is_binary(kind) and is_integer(limit) and limit > 0 do
    now = utc_now()

    kind
    |> due_jobs_query(now, limit)
    |> claim_due_jobs_transaction(now)
  end

  @doc """
  Marks a claimed job as completed.
  """
  @spec mark_completed(pos_integer()) :: job_result()
  def mark_completed(job_id) when is_integer(job_id) and job_id > 0 do
    with %AsyncJobSchema{} = job <- Repo.get(AsyncJobSchema, job_id) do
      job
      |> changeset(%{
        status: :completed,
        completed_at: utc_now(),
        locked_at: nil,
        last_error: nil
      })
      |> Repo.update()
    else
      nil -> {:error, :not_found}
    end
  end

  @doc """
  Marks a claimed job for retry or terminal failure based on attempts remaining.
  """
  @spec mark_retry(pos_integer(), String.t(), non_neg_integer()) :: job_result()
  def mark_retry(job_id, reason, backoff_seconds)
      when is_integer(job_id) and job_id > 0 and is_binary(reason) and is_integer(backoff_seconds) and
             backoff_seconds >= 0 do
    with %AsyncJobSchema{} = job <- Repo.get(AsyncJobSchema, job_id) do
      now = utc_now()

      attrs =
        if job.attempts >= job.max_attempts do
          %{status: :failed, locked_at: nil, completed_at: nil, last_error: reason}
        else
          %{
            status: :pending,
            scheduled_at: DateTime.add(now, backoff_seconds, :second),
            locked_at: nil,
            completed_at: nil,
            last_error: reason
          }
        end

      job
      |> changeset(attrs)
      |> Repo.update()
    else
      nil -> {:error, :not_found}
    end
  end

  @spec claim_due_jobs_transaction(Ecto.Queryable.t(), DateTime.t()) :: [AsyncJobSchema.t()]
  defp claim_due_jobs_transaction(query, now) do
    # Claiming and transition to `:processing` happen in one transaction so
    # parallel workers cannot race the same due row.
    {:ok, jobs} =
      Repo.transaction(fn ->
        query
        |> Repo.all()
        |> Enum.map(&claim_job(&1, now))
      end)

    jobs
  end

  @spec due_jobs_query(String.t(), DateTime.t(), pos_integer()) :: Ecto.Query.t()
  defp due_jobs_query(kind, now, limit) do
    from(job in AsyncJobSchema,
      where: job.kind == ^kind and job.status == :pending and job.scheduled_at <= ^now,
      order_by: [asc: job.scheduled_at, asc: job.id],
      limit: ^limit,
      lock: "FOR UPDATE SKIP LOCKED"
    )
  end

  @spec claim_job(AsyncJobSchema.t(), DateTime.t()) :: AsyncJobSchema.t()
  defp claim_job(%AsyncJobSchema{} = job, now) do
    job
    |> changeset(%{status: :processing, locked_at: now, attempts: job.attempts + 1})
    |> Repo.update!()
  end

  @spec insert_job(String.t(), map(), enqueue_opts()) ::
          {:ok, AsyncJobSchema.t()} | {:error, changeset()}
  defp insert_job(kind, payload, opts) do
    attrs = %{
      kind: kind,
      payload: payload,
      dedupe_key: Keyword.get(opts, :dedupe_key),
      max_attempts: Keyword.get(opts, :max_attempts, 10),
      scheduled_at: Keyword.get(opts, :scheduled_at, utc_now())
    }

    %AsyncJobSchema{}
    |> changeset(attrs)
    |> Repo.insert()
  end

  @spec maybe_get_existing_by_dedupe_key(String.t() | nil) :: AsyncJobSchema.t() | nil
  defp maybe_get_existing_by_dedupe_key(nil), do: nil

  defp maybe_get_existing_by_dedupe_key(dedupe_key),
    do: Repo.get_by(AsyncJobSchema, dedupe_key: dedupe_key)

  @spec maybe_resolve_dedupe_conflict(changeset(), String.t() | nil) :: job_result()
  defp maybe_resolve_dedupe_conflict(changeset, dedupe_key) do
    cond do
      is_nil(dedupe_key) ->
        {:error, changeset}

      dedupe_conflict?(changeset) ->
        case Repo.get_by(AsyncJobSchema, dedupe_key: dedupe_key) do
          %AsyncJobSchema{} = existing_job -> {:ok, existing_job}
          nil -> {:error, changeset}
        end

      true ->
        {:error, changeset}
    end
  end

  @spec dedupe_conflict?(changeset()) :: boolean()
  defp dedupe_conflict?(changeset) do
    Enum.any?(changeset.errors, fn {field, _details} -> field == :dedupe_key end)
  end

  @spec changeset(AsyncJobSchema.t(), map()) :: changeset()
  defp changeset(%AsyncJobSchema{} = async_job, attrs) when is_map(attrs) do
    async_job
    |> cast(attrs, [
      :kind,
      :dedupe_key,
      :status,
      :payload,
      :attempts,
      :max_attempts,
      :scheduled_at,
      :locked_at,
      :completed_at,
      :last_error
    ])
    |> validate_required([:kind, :status, :payload, :attempts, :max_attempts, :scheduled_at])
    |> validate_number(:attempts, greater_than_or_equal_to: 0)
    |> validate_number(:max_attempts, greater_than: 0)
    |> unique_constraint(:dedupe_key, name: :async_jobs_dedupe_key_index)
    |> check_constraint(:attempts, name: :async_jobs_attempts_nonnegative)
    |> check_constraint(:max_attempts, name: :async_jobs_max_attempts_positive)
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
