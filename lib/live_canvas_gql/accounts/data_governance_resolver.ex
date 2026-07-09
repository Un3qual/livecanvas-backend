defmodule LCGQL.Accounts.DataGovernanceResolver do
  alias LC.Accounts
  alias LCGQL.MutationErrors
  alias LCGQL.Relay

  @type mutation_error :: MutationErrors.user_error()
  @type data_export_request_payload :: %{
          data_export_request: map() | nil,
          errors: [mutation_error()]
        }
  @type data_export_request_result :: {:ok, data_export_request_payload()}
  @type account_deletion_request_payload :: %{
          account_deletion_request: map() | nil,
          errors: [mutation_error()]
        }
  @type account_deletion_request_result :: {:ok, account_deletion_request_payload()}
  @type data_export_error_reason :: :enqueue_failed | :unauthenticated
  @type account_deletion_error_reason ::
          :enqueue_failed
          | :unauthenticated
          | :not_found
          | :already_processing
          | :cannot_cancel
          | :invalid_request_id

  @spec request_viewer_data_export(
          term(),
          %{optional(:input) => map(), optional(:format) => atom()},
          Absinthe.Resolution.t()
        ) :: data_export_request_result()
  def request_viewer_data_export(parent, %{input: input}, resolution),
    do: request_viewer_data_export(parent, input, resolution)

  def request_viewer_data_export(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    format = Map.get(args, :format, :json)

    case Accounts.request_user_data_export(user, format: format) do
      {:ok, request} ->
        {:ok, %{data_export_request: request, errors: []}}

      {:error, :enqueue_failed} ->
        {:ok, %{data_export_request: nil, errors: [data_export_error(:enqueue_failed)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           data_export_request: nil,
           errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)
         }}
    end
  end

  def request_viewer_data_export(_parent, _args, _resolution) do
    {:ok, %{data_export_request: nil, errors: [data_export_error(:unauthenticated)]}}
  end

  @spec request_viewer_account_deletion(
          term(),
          %{optional(:input) => map(), optional(:grace_period_seconds) => integer()},
          Absinthe.Resolution.t()
        ) :: account_deletion_request_result()
  def request_viewer_account_deletion(parent, %{input: input}, resolution),
    do: request_viewer_account_deletion(parent, input, resolution)

  def request_viewer_account_deletion(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    case Accounts.request_user_account_deletion(user, account_deletion_request_opts(args)) do
      {:ok, request} ->
        {:ok, %{account_deletion_request: request, errors: []}}

      {:error, :enqueue_failed} ->
        {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:enqueue_failed)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           account_deletion_request: nil,
           errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)
         }}
    end
  end

  def request_viewer_account_deletion(_parent, _args, _resolution) do
    {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:unauthenticated)]}}
  end

  @spec cancel_viewer_account_deletion_request(
          term(),
          %{optional(:input) => map(), optional(:account_deletion_request_id) => String.t()},
          Absinthe.Resolution.t()
        ) :: account_deletion_request_result()
  def cancel_viewer_account_deletion_request(parent, %{input: input}, resolution),
    do: cancel_viewer_account_deletion_request(parent, input, resolution)

  def cancel_viewer_account_deletion_request(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, request_id} <- decode_account_deletion_request_id(args),
         {:ok, request} <- Accounts.cancel_user_account_deletion_request(user, request_id) do
      {:ok, %{account_deletion_request: request, errors: []}}
    else
      {:error, :invalid_id} ->
        {:ok,
         %{
           account_deletion_request: nil,
           errors: [account_deletion_error(:invalid_request_id)]
         }}

      {:error, :invalid_type} ->
        {:ok,
         %{
           account_deletion_request: nil,
           errors: [account_deletion_error(:invalid_request_id)]
         }}

      {:error, :not_found} ->
        {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:not_found)]}}

      {:error, :already_processing} ->
        {:ok,
         %{account_deletion_request: nil, errors: [account_deletion_error(:already_processing)]}}

      {:error, :cannot_cancel} ->
        {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:cannot_cancel)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           account_deletion_request: nil,
           errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)
         }}
    end
  end

  def cancel_viewer_account_deletion_request(_parent, _args, _resolution) do
    {:ok, %{account_deletion_request: nil, errors: [account_deletion_error(:unauthenticated)]}}
  end

  @spec viewer_data_export_requests(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_data_export_requests(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    user
    |> Accounts.list_user_data_export_requests()
    |> Absinthe.Relay.Connection.from_list(args)
  end

  def viewer_data_export_requests(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
  end

  @spec viewer_account_deletion_requests(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_account_deletion_requests(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    user
    |> Accounts.list_user_account_deletion_requests()
    |> Absinthe.Relay.Connection.from_list(args)
  end

  def viewer_account_deletion_requests(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
  end

  @spec data_export_error(data_export_error_reason()) :: mutation_error()
  defp data_export_error(:enqueue_failed),
    do: MutationErrors.user_error(nil, "export_unavailable")

  defp data_export_error(:unauthenticated),
    do: MutationErrors.user_error(nil, :unauthenticated)

  @spec account_deletion_error(account_deletion_error_reason()) :: mutation_error()
  defp account_deletion_error(:enqueue_failed),
    do: MutationErrors.user_error(nil, "deletion_unavailable")

  defp account_deletion_error(:unauthenticated),
    do: MutationErrors.user_error(nil, :unauthenticated)

  defp account_deletion_error(:not_found),
    do: MutationErrors.user_error(nil, :not_found)

  defp account_deletion_error(:already_processing),
    do: MutationErrors.user_error(nil, :already_processing)

  defp account_deletion_error(:cannot_cancel),
    do: MutationErrors.user_error(nil, :cannot_cancel)

  defp account_deletion_error(:invalid_request_id),
    do: MutationErrors.invalid_error("accountDeletionRequestId")

  @spec decode_account_deletion_request_id(map()) ::
          {:ok, pos_integer()} | {:error, Relay.decode_error()}
  defp decode_account_deletion_request_id(args) when is_map(args) do
    args
    |> Map.get(:account_deletion_request_id)
    |> Relay.decode_global_id(:account_deletion_request, LCGQL.Schema)
  end

  @spec account_deletion_request_opts(map()) ::
          [{:grace_period_seconds, non_neg_integer()} | {:job_max_attempts, pos_integer()}]
  defp account_deletion_request_opts(args) when is_map(args) do
    args
    |> Map.take([:grace_period_seconds, :job_max_attempts])
    |> Enum.to_list()
    |> Enum.filter(fn
      {:grace_period_seconds, value} when is_integer(value) and value >= 0 -> true
      {:job_max_attempts, value} when is_integer(value) and value > 0 -> true
      _ -> false
    end)
  end
end
