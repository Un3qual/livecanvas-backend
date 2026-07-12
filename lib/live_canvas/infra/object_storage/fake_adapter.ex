defmodule LC.Infra.ObjectStorage.FakeAdapter do
  @moduledoc false

  use GenServer

  @behaviour LC.Infra.ObjectStorage

  @upload_ttl_seconds 900
  @objects_table __MODULE__

  @type state :: :ets.tid()

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @impl true
  @spec init(:ok) :: {:ok, state()}
  def init(:ok) do
    table =
      :ets.new(@objects_table, [
        :named_table,
        :public,
        :set,
        read_concurrency: true,
        write_concurrency: true
      ])

    {:ok, table}
  end

  @impl LC.Infra.ObjectStorage
  @spec sign_upload(LC.Infra.ObjectStorage.upload_request()) ::
          {:ok, LC.Infra.ObjectStorage.signed_upload()} | {:error, term()}
  def sign_upload(%{key: key, mime_type: mime_type})
      when is_binary(key) and is_binary(mime_type) do
    expires_at =
      DateTime.utc_now()
      |> DateTime.add(@upload_ttl_seconds, :second)
      |> DateTime.truncate(:second)

    {:ok,
     %{
       method: :put,
       url: "https://object-storage.invalid/#{key}",
       headers: %{"content-type" => mime_type, "if-none-match" => "*"},
       expires_at: expires_at
     }}
  end

  def sign_upload(_request), do: {:error, :invalid_upload_request}

  @impl LC.Infra.ObjectStorage
  @spec verify_upload(LC.Infra.ObjectStorage.verification_request()) ::
          {:ok, LC.Infra.ObjectStorage.verified_upload()} | {:error, term()}
  def verify_upload(%{key: key, mime_type: mime_type, max_bytes: max_bytes})
      when is_binary(key) and is_binary(mime_type) and is_integer(max_bytes) and max_bytes > 0 do
    case get_object(key) do
      nil ->
        {:error, :upload_not_found}

      %{content_length: 0} ->
        {:error, :empty_upload}

      %{content_length: content_length} when content_length > max_bytes ->
        {:error, :upload_too_large}

      %{mime_type: ^mime_type, content_length: content_length} ->
        {:ok, %{content_length: content_length, content_type: mime_type}}

      %{mime_type: _other_mime_type} ->
        {:error, :content_type_mismatch}
    end
  end

  def verify_upload(_request), do: {:error, :invalid_verification_request}

  @doc false
  @spec put_object(%{key: String.t(), mime_type: String.t(), content_length: non_neg_integer()}) ::
          :ok | {:error, :precondition_failed | :invalid_upload_request}
  def put_object(%{key: key, mime_type: mime_type, content_length: content_length} = object)
      when is_binary(key) and is_binary(mime_type) and is_integer(content_length) and
             content_length >= 0 do
    case :ets.insert_new(@objects_table, {key, object}) do
      true -> :ok
      false -> {:error, :precondition_failed}
    end
  end

  def put_object(_object), do: {:error, :invalid_upload_request}

  @impl LC.Infra.ObjectStorage
  @spec public_asset_url(LC.Infra.ObjectStorage.storage_key()) ::
          {:ok, String.t()} | {:error, term()}
  def public_asset_url(key) when is_binary(key) do
    {:ok, "https://object-storage.invalid/#{key}"}
  end

  def public_asset_url(_key), do: {:error, :invalid_storage_key}

  @spec get_object(String.t()) :: map() | nil
  defp get_object(key) do
    case :ets.lookup(@objects_table, key) do
      [{^key, object}] -> object
      [] -> nil
    end
  end
end
