defmodule LC.Infra.DataGovernance do
  @moduledoc false

  alias LC.Infra.DataGovernance.Export
  alias LCSchemas.Accounts.User
  alias LCSchemas.Infra.DataExportRequest

  @type changeset :: Ecto.Changeset.t()
  @type request_opts :: [{:format, LCSchemas.Infra.data_export_request_format()}]
  @type request_result :: {:ok, DataExportRequest.t()} | {:error, changeset() | :enqueue_failed}

  @doc """
  Creates or reuses an active export request for the given viewer.
  """
  @spec request_data_export(User.t(), request_opts()) :: request_result()
  def request_data_export(%User{} = user, opts \\ []) when is_list(opts) do
    Export.request(user, opts)
  end

  @doc """
  Lists export requests for the given viewer in reverse-chronological order.
  """
  @spec list_data_export_requests(User.t()) :: [DataExportRequest.t()]
  def list_data_export_requests(%User{} = user), do: Export.list(user)

  @doc """
  Fetches a viewer-owned export request by local ID.
  """
  @spec get_data_export_request(User.t(), pos_integer()) :: DataExportRequest.t() | nil
  def get_data_export_request(%User{} = user, request_id)
      when is_integer(request_id) and request_id > 0 do
    Export.get(user, request_id)
  end
end
