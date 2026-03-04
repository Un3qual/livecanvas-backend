defmodule LC.Infra.AsyncJobs.Worker do
  @moduledoc false

  use GenServer

  require Logger

  alias LC.Infra.AsyncJobs
  alias LC.Infra.AsyncJobs.Handler
  alias LCSchemas.Infra.AsyncJob

  @poll_message :poll
  @default_poll_interval_ms 1_000
  @default_claim_limit 20
  @default_backoff_schedule_seconds [15, 60, 180, 600]

  @type handler_registry :: Handler.handler_registry()
  @type state :: %{
          poll_interval_ms: pos_integer(),
          claim_limit: pos_integer(),
          handlers: handler_registry()
        }
  @type start_opt ::
          {:name, GenServer.name()}
          | {:poll_interval_ms, pos_integer()}
          | {:claim_limit, pos_integer()}
          | {:handlers, handler_registry()}

  @spec start_link([start_opt()]) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, Keyword.take(opts, [:name]))
  end

  @impl true
  @spec init([start_opt()]) :: {:ok, state()}
  def init(opts) when is_list(opts) do
    state = %{
      poll_interval_ms: poll_interval_ms(opts),
      claim_limit: claim_limit(opts),
      handlers: handlers(opts)
    }

    {:ok, schedule_next_poll(state)}
  end

  @impl true
  @spec handle_info(term(), state()) :: {:noreply, state()}
  def handle_info(@poll_message, state) do
    run_poll_cycle(state)
    {:noreply, schedule_next_poll(state)}
  end

  def handle_info(_message, state), do: {:noreply, state}

  @spec run_poll_cycle(state()) :: :ok
  defp run_poll_cycle(%{handlers: handlers, claim_limit: claim_limit}) do
    handlers
    |> Map.keys()
    |> Enum.each(fn kind ->
      kind
      |> AsyncJobs.claim_due_jobs(claim_limit)
      |> Enum.each(&handle_claimed_job(&1, handlers))
    end)
  end

  @spec handle_claimed_job(AsyncJob.t(), handler_registry()) :: :ok
  defp handle_claimed_job(%AsyncJob{} = job, handlers) do
    # Jobs are claimed with `FOR UPDATE SKIP LOCKED` and transitioned to
    # `:processing` before dispatch, so completion/retry updates below are safe
    # against double-processing races across worker instances.
    case safe_dispatch(job, handlers) do
      :ok ->
        complete_job(job)

      {:ok, _metadata} ->
        complete_job(job)

      {:retry, reason, backoff_seconds} ->
        retry_job(job, reason, backoff_seconds)

      {:error, reason} ->
        reason
        |> to_reason()
        |> then(&retry_job(job, &1, default_backoff_seconds(job)))
    end
  end

  @spec safe_dispatch(AsyncJob.t(), handler_registry()) :: Handler.result()
  defp safe_dispatch(job, handlers) do
    Handler.dispatch(job, handlers)
  rescue
    exception ->
      {:error, Exception.message(exception)}
  catch
    kind, value ->
      {:error, "#{kind}:#{inspect(value)}"}
  end

  @spec complete_job(AsyncJob.t()) :: :ok
  defp complete_job(%AsyncJob{id: job_id}) when is_integer(job_id) and job_id > 0 do
    case AsyncJobs.mark_completed(job_id) do
      {:ok, _completed_job} ->
        :ok

      {:error, reason} ->
        Logger.warning("async job completion failed for job=#{job_id}: #{inspect(reason)}")
        :ok
    end
  end

  @spec retry_job(AsyncJob.t(), Handler.reason(), non_neg_integer()) :: :ok
  defp retry_job(%AsyncJob{id: job_id} = job, reason, backoff_seconds)
       when is_integer(job_id) and job_id > 0 and is_integer(backoff_seconds) and
              backoff_seconds >= 0 do
    case AsyncJobs.mark_retry(job_id, to_reason(reason), backoff_seconds) do
      {:ok, _retried_job} ->
        :ok

      {:error, mark_retry_reason} ->
        Logger.warning(
          "async job retry scheduling failed for job=#{job_id} kind=#{job.kind}: #{inspect(mark_retry_reason)}"
        )

        :ok
    end
  end

  @spec schedule_next_poll(state()) :: state()
  defp schedule_next_poll(%{poll_interval_ms: poll_interval_ms} = state) do
    Process.send_after(self(), @poll_message, poll_interval_ms)
    state
  end

  @spec default_backoff_seconds(AsyncJob.t()) :: non_neg_integer()
  defp default_backoff_seconds(%AsyncJob{attempts: attempts}) do
    now = utc_now()
    DateTime.diff(next_retry_at(now, attempts), now, :second)
  end

  @spec next_retry_at(DateTime.t(), non_neg_integer() | nil) :: DateTime.t()
  defp next_retry_at(%DateTime{} = now, attempts) when is_integer(attempts) and attempts >= 0 do
    schedule_index = max(attempts - 1, 0)

    backoff_seconds =
      Enum.at(@default_backoff_schedule_seconds, schedule_index) ||
        List.last(@default_backoff_schedule_seconds)

    DateTime.add(now, backoff_seconds, :second)
  end

  defp next_retry_at(%DateTime{} = now, _attempts) do
    DateTime.add(now, hd(@default_backoff_schedule_seconds), :second)
  end

  @spec poll_interval_ms([start_opt()]) :: pos_integer()
  defp poll_interval_ms(opts) do
    opts
    |> Keyword.get(
      :poll_interval_ms,
      worker_config_value(:poll_interval_ms, @default_poll_interval_ms)
    )
    |> ensure_positive_integer(@default_poll_interval_ms)
  end

  @spec claim_limit([start_opt()]) :: pos_integer()
  defp claim_limit(opts) do
    opts
    |> Keyword.get(:claim_limit, worker_config_value(:claim_limit, @default_claim_limit))
    |> ensure_positive_integer(@default_claim_limit)
  end

  @spec handlers([start_opt()]) :: handler_registry()
  defp handlers(opts) do
    opts
    |> Keyword.get(:handlers, worker_config_value(:handlers, %{}))
    |> normalize_handlers()
  end

  @spec normalize_handlers(term()) :: handler_registry()
  defp normalize_handlers(handlers) when is_map(handlers) do
    handlers
    |> Enum.reduce(%{}, fn
      {kind, handler}, acc when is_binary(kind) and is_atom(handler) ->
        Map.put(acc, kind, handler)

      _, acc ->
        acc
    end)
  end

  defp normalize_handlers(_handlers), do: %{}

  defp ensure_positive_integer(value, _default) when is_integer(value) and value > 0, do: value
  defp ensure_positive_integer(_value, default), do: default

  defp worker_config_value(key, default) when is_atom(key) do
    __MODULE__
    |> Application.get_env(:live_canvas, [])
    |> Keyword.get(key, default)
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)

  @spec to_reason(Handler.reason()) :: String.t()
  defp to_reason(reason) when is_binary(reason), do: reason
  defp to_reason(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp to_reason(reason), do: inspect(reason)
end
