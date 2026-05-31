defmodule LC.Infra.DataGovernance do
  @moduledoc false

  alias LC.Infra.DataGovernance.Deletion
  alias LC.Infra.DataGovernance.Export
  alias LC.Infra.DataGovernance.Retention
  alias LCSchemas.Accounts.User
  alias LCSchemas.Infra.{AccountDeletionRequest, DataExportRequest}

  @type changeset :: Ecto.Changeset.t()
  @type request_opts :: [{:format, LCSchemas.Infra.data_export_request_format()}]
  @type request_result :: {:ok, DataExportRequest.t()} | {:error, changeset() | :enqueue_failed}
  @type account_deletion_request_opts ::
          [{:grace_period_seconds, non_neg_integer()} | {:job_max_attempts, pos_integer()}]
  @type account_deletion_request_result ::
          {:ok, AccountDeletionRequest.t()} | {:error, changeset() | :enqueue_failed}
  @type account_deletion_cancel_error :: :not_found | :already_processing | :cannot_cancel
  @type account_deletion_cancel_result ::
          {:ok, AccountDeletionRequest.t()}
          | {:error, account_deletion_cancel_error() | changeset()}
  @type retention_opts ::
          [{:cutoff_days, pos_integer()} | {:dry_run, boolean()} | {:apply, boolean()}]
  @type retention_result :: {:ok, Retention.report()} | {:error, Retention.run_error()}

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
  @spec get_data_export_request(User.t(), integer()) :: DataExportRequest.t() | nil
  def get_data_export_request(%User{} = user, request_id)
      when is_integer(request_id) do
    Export.get(user, request_id)
  end

  @doc """
  Creates or reuses an active account deletion request for the given viewer.
  """
  @spec request_account_deletion(User.t(), account_deletion_request_opts()) ::
          account_deletion_request_result()
  def request_account_deletion(%User{} = user, opts \\ []) when is_list(opts) do
    Deletion.request(user, opts)
  end

  @doc """
  Lists account deletion requests for the given viewer in reverse-chronological order.
  """
  @spec list_account_deletion_requests(User.t()) :: [AccountDeletionRequest.t()]
  def list_account_deletion_requests(%User{} = user), do: Deletion.list(user)

  @doc """
  Fetches a viewer-owned account deletion request by local ID.
  """
  @spec get_account_deletion_request(User.t(), integer()) :: AccountDeletionRequest.t() | nil
  def get_account_deletion_request(%User{} = user, request_id)
      when is_integer(request_id) do
    Deletion.get(user, request_id)
  end

  @doc """
  Cancels a viewer-owned account deletion request when still cancelable.
  """
  @spec cancel_account_deletion_request(User.t(), pos_integer()) ::
          account_deletion_cancel_result()
  def cancel_account_deletion_request(%User{} = user, request_id)
      when is_integer(request_id) and request_id > 0 do
    Deletion.cancel(user, request_id)
  end

  @doc """
  Runs the operational retention sweep report for governance-owned tables.
  """
  @spec run_retention_sweep(retention_opts()) :: retention_result()
  def run_retention_sweep(opts \\ []) when is_list(opts) do
    Retention.run(opts)
  end
end
