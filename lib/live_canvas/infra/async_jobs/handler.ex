defmodule LC.Infra.AsyncJobs.Handler do
  @moduledoc false

  alias LCSchemas.Infra.AsyncJob

  @type handler_module :: module()
  @type handler_registry :: %{optional(String.t()) => handler_module()}
  @type reason :: String.t() | atom() | term()
  @type result ::
          :ok
          | {:ok, term()}
          | {:retry, reason(), non_neg_integer()}
          | {:error, reason()}

  @callback handle(AsyncJob.t()) :: result()

  @spec dispatch(AsyncJob.t(), handler_registry()) :: result()
  def dispatch(%AsyncJob{kind: kind} = job, handlers)
      when is_binary(kind) and is_map(handlers) do
    case Map.get(handlers, kind) do
      nil ->
        {:error, :missing_handler}

      handler when is_atom(handler) ->
        handler.handle(job)
    end
  end
end
