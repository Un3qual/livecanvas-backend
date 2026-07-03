defmodule LC.Infra.DataGovernance.Requests do
  @moduledoc false

  import Ecto.Query, only: [from: 2]

  alias LC.Infra.Repo
  alias LCPayload.Payload
  alias LCSchemas.Accounts.User
  alias LCSchemas.Infra.AsyncJob

  @type request_handler :: (struct() -> LC.Infra.AsyncJobs.Handler.result())

  @spec list(module(), User.t()) :: [struct()]
  def list(request_schema, %User{id: user_id})
      when is_atom(request_schema) and is_integer(user_id) and user_id > 0 do
    from(request in request_schema,
      where: request.user_id == ^user_id,
      order_by: [desc: request.inserted_at, desc: request.id]
    )
    |> Repo.all()
  end

  @spec get(module(), User.t(), integer()) :: struct() | nil
  def get(request_schema, %User{id: user_id}, request_id)
      when is_atom(request_schema) and is_integer(user_id) and is_integer(request_id) do
    Repo.get_by(request_schema, id: request_id, user_id: user_id)
  end

  @spec handle_job_payload(map(), module(), atom(), request_handler()) ::
          LC.Infra.AsyncJobs.Handler.result()
  def handle_job_payload(payload, request_schema, payload_key, request_handler)
      when is_map(payload) and is_atom(request_schema) and is_atom(payload_key) and
             is_function(request_handler, 1) do
    with {:ok, request_id} <- Payload.positive_integer(payload, payload_key),
         %{} = request <- Repo.get(request_schema, request_id) do
      request_handler.(request)
    else
      # Missing request rows are successful no-ops so retried jobs stay idempotent.
      nil -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @spec handle_job(AsyncJob.t(), String.t(), module(), atom(), request_handler()) ::
          LC.Infra.AsyncJobs.Handler.result()
  def handle_job(
        %AsyncJob{kind: job_kind, payload: payload},
        job_kind,
        request_schema,
        payload_key,
        handler
      )
      when is_map(payload) do
    handle_job_payload(payload, request_schema, payload_key, handler)
  end

  def handle_job(%AsyncJob{kind: job_kind}, job_kind, _request_schema, _payload_key, _handler) do
    {:error, :invalid_payload}
  end

  def handle_job(%AsyncJob{}, _job_kind, _request_schema, _payload_key, _handler) do
    {:error, :unsupported_job_kind}
  end
end
