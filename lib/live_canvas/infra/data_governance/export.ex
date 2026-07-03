defmodule LC.Infra.DataGovernance.Export do
  @moduledoc false

  import Ecto.Changeset
  import Ecto.Query, only: [from: 2]

  alias LC.Infra.{AsyncJobs, Payload, Repo}
  alias LCSchemas.Accounts.User

  alias LCSchemas.Chat.{
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState
  }

  alias LCSchemas.Infra.{AsyncJob, DataExportRequest}

  @behaviour LC.Infra.AsyncJobs.Handler

  @job_kind "data_export_request"
  @job_max_attempts 3

  @type changeset :: Ecto.Changeset.t()
  @type request_opts :: [{:format, LCSchemas.Infra.data_export_request_format()}]
  @type request_result :: {:ok, DataExportRequest.t()} | {:error, changeset() | :enqueue_failed}
  @typep timeline_chat_export_row :: %{
           required(:event_id) => Ecto.UUID.t(),
           required(:live_session_id) => pos_integer(),
           required(:body) => String.t() | nil,
           required(:occurred_at) => DateTime.t(),
           required(:edited) => boolean(),
           required(:edit_count) => non_neg_integer()
         }
  @typep timeline_chat_export_record :: %{
           required(String.t()) =>
             String.t() | pos_integer() | boolean() | non_neg_integer() | nil
         }
  @typep export_records :: %{required(String.t()) => [timeline_chat_export_record()]}

  @spec request(User.t(), request_opts()) :: request_result()
  def request(%User{id: user_id}, opts \\ []) when is_integer(user_id) and user_id > 0 do
    format = Keyword.get(opts, :format, :json)

    user_id
    |> upsert_pending_request_transaction(format)
    |> normalize_transaction_result()
  end

  @spec list(User.t()) :: [DataExportRequest.t()]
  def list(%User{id: user_id}) when is_integer(user_id) and user_id > 0 do
    from(request in DataExportRequest,
      where: request.user_id == ^user_id,
      order_by: [desc: request.inserted_at, desc: request.id]
    )
    |> Repo.all()
  end

  @spec get(User.t(), integer()) :: DataExportRequest.t() | nil
  def get(%User{id: user_id}, request_id)
      when is_integer(user_id) and is_integer(request_id) do
    Repo.get_by(DataExportRequest, id: request_id, user_id: user_id)
  end

  @impl LC.Infra.AsyncJobs.Handler
  @spec handle(AsyncJob.t()) :: LC.Infra.AsyncJobs.Handler.result()
  def handle(%AsyncJob{kind: @job_kind, payload: payload}) when is_map(payload) do
    with {:ok, request_id} <- Payload.positive_integer(payload, :data_export_request_id),
         %DataExportRequest{} = request <- Repo.get(DataExportRequest, request_id) do
      complete_export_request(request)
    else
      nil ->
        # Idempotent worker behavior: if the request was removed out-of-band,
        # acknowledge and allow the queue to drain.
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  def handle(%AsyncJob{kind: @job_kind}), do: {:error, :invalid_payload}
  def handle(%AsyncJob{}), do: {:error, :unsupported_job_kind}

  @spec upsert_pending_request_transaction(
          pos_integer(),
          LCSchemas.Infra.data_export_request_format()
        ) ::
          {:ok, DataExportRequest.t()} | {:error, changeset() | :enqueue_failed}
  defp upsert_pending_request_transaction(user_id, format) do
    Repo.transact(fn ->
      case get_pending_request(user_id) do
        %DataExportRequest{} = existing_request ->
          {:ok, existing_request}

        nil ->
          with {:ok, request} <- insert_request(user_id, format),
               {:ok, _job} <- enqueue_request(request) do
            {:ok, request}
          end
      end
    end)
  end

  @spec normalize_transaction_result(
          {:ok, DataExportRequest.t()}
          | {:error, changeset() | :enqueue_failed}
        ) :: request_result()
  defp normalize_transaction_result({:ok, %DataExportRequest{} = request}), do: {:ok, request}
  defp normalize_transaction_result({:error, reason}), do: {:error, reason}

  @spec get_pending_request(pos_integer()) :: DataExportRequest.t() | nil
  defp get_pending_request(user_id) when is_integer(user_id) and user_id > 0 do
    from(request in DataExportRequest,
      where: request.user_id == ^user_id and request.status in [:pending, :processing],
      order_by: [desc: request.inserted_at, desc: request.id],
      limit: 1
    )
    |> Repo.one()
  end

  @spec insert_request(pos_integer(), LCSchemas.Infra.data_export_request_format()) ::
          {:ok, DataExportRequest.t()} | {:error, changeset()}
  defp insert_request(user_id, format) do
    %DataExportRequest{}
    |> request_changeset(%{
      user_id: user_id,
      status: :pending,
      format: format,
      requested_at: utc_now()
    })
    |> Repo.insert()
  end

  @spec enqueue_request(DataExportRequest.t()) :: {:ok, AsyncJob.t()} | {:error, :enqueue_failed}
  defp enqueue_request(%DataExportRequest{id: request_id})
       when is_integer(request_id) and request_id > 0 do
    case AsyncJobs.enqueue(
           @job_kind,
           %{data_export_request_id: request_id},
           dedupe_key: "data_export_request:#{request_id}",
           max_attempts: @job_max_attempts
         ) do
      {:ok, %AsyncJob{} = job} ->
        {:ok, job}

      {:error, _reason} ->
        {:error, :enqueue_failed}
    end
  end

  @spec complete_export_request(DataExportRequest.t()) :: LC.Infra.AsyncJobs.Handler.result()
  defp complete_export_request(%DataExportRequest{status: :completed}), do: :ok
  defp complete_export_request(%DataExportRequest{status: :failed}), do: :ok

  defp complete_export_request(%DataExportRequest{} = request) do
    with {:ok, processing_request} <- update_request(request, %{status: :processing}),
         {:ok, _completed_request} <-
           update_request(processing_request, %{
             status: :completed,
             completed_at: utc_now(),
             failure_reason: nil,
             artifact_metadata: artifact_metadata(processing_request)
           }) do
      :ok
    end
  end

  @spec update_request(DataExportRequest.t(), map()) ::
          {:ok, DataExportRequest.t()} | {:error, changeset()}
  defp update_request(%DataExportRequest{} = request, attrs) when is_map(attrs) do
    request
    |> request_changeset(attrs)
    |> Repo.update()
  end

  @spec request_changeset(DataExportRequest.t(), map()) :: changeset()
  defp request_changeset(%DataExportRequest{} = request, attrs) when is_map(attrs) do
    request
    |> cast(attrs, [
      :user_id,
      :status,
      :format,
      :requested_at,
      :completed_at,
      :artifact_metadata,
      :failure_reason
    ])
    |> validate_required([:user_id, :status, :format, :requested_at])
    |> unique_constraint(:entropy_id)
  end

  @spec artifact_metadata(DataExportRequest.t()) :: map()
  defp artifact_metadata(%DataExportRequest{
         entropy_id: entropy_id,
         user_id: user_id
       })
       when is_binary(entropy_id) and is_integer(user_id) do
    %{
      "object_key" => "exports/users/#{user_id}/requests/#{entropy_id}.json",
      "content_type" => "application/json",
      "generated_at" => DateTime.to_iso8601(utc_now()),
      "records" => export_records(user_id)
    }
  end

  @spec export_records(pos_integer()) :: export_records()
  defp export_records(user_id) when is_integer(user_id) and user_id > 0 do
    %{
      "live_session_timeline_events" => timeline_chat_projection_records(user_id)
    }
  end

  @spec timeline_chat_projection_records(pos_integer()) :: [timeline_chat_export_record()]
  defp timeline_chat_projection_records(user_id) when is_integer(user_id) and user_id > 0 do
    from(event in LiveSessionTimelineEvent,
      join: event_state in LiveSessionTimelineEventState,
      on: event_state.timeline_event_id == event.id,
      join: chat_message_state in LiveSessionTimelineChatMessageState,
      on: chat_message_state.timeline_event_id == event.id,
      where:
        event.actor_user_id == ^user_id and event.event_type == :chat_message_sent and
          event_state.projection_state in [:visible, :redacted_placeholder],
      order_by: [asc: event.occurred_at, asc: event.id],
      select: %{
        event_id: event.entropy_id,
        live_session_id: event.live_session_id,
        body: chat_message_state.current_body,
        occurred_at: event.occurred_at,
        edited: fragment("coalesce(?, 0) > 0", chat_message_state.edit_count),
        edit_count: type(fragment("coalesce(?, 0)", chat_message_state.edit_count), :integer)
      }
    )
    |> Repo.all()
    |> Enum.map(&timeline_chat_projection_record/1)
  end

  @spec timeline_chat_projection_record(timeline_chat_export_row()) ::
          timeline_chat_export_record()
  defp timeline_chat_projection_record(row) do
    %{
      "type" => "chat_message",
      "event_id" => row.event_id,
      "live_session_id" => row.live_session_id,
      "body" => row.body,
      "occurred_at" => DateTime.to_iso8601(row.occurred_at),
      "edited" => row.edited,
      "edit_count" => row.edit_count
    }
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end
