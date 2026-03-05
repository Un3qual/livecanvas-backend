defmodule LC.Infra.ObjectStorage.ConfigurableAdapter do
  @moduledoc false

  @behaviour LC.Infra.ObjectStorage

  @default_upload_ttl_seconds 900

  @type adapter_config :: %{
          upload_base_url: String.t(),
          public_base_url: String.t(),
          upload_ttl_seconds: pos_integer()
        }

  @impl LC.Infra.ObjectStorage
  @spec sign_upload(LC.Infra.ObjectStorage.upload_request()) ::
          {:ok, LC.Infra.ObjectStorage.signed_upload()} | {:error, term()}
  def sign_upload(%{key: key, mime_type: mime_type})
      when is_binary(key) and is_binary(mime_type) do
    with :ok <- validate_storage_key(key),
         {:ok, config} <- fetch_config(),
         {:ok, upload_url} <- build_object_url(config.upload_base_url, key),
         {:ok, expires_at} <- upload_expiration(config.upload_ttl_seconds) do
      {:ok,
       %{
         method: :put,
         url: upload_url,
         headers: %{"content-type" => mime_type},
         expires_at: expires_at
       }}
    end
  end

  def sign_upload(_request), do: {:error, :invalid_upload_request}

  @impl LC.Infra.ObjectStorage
  @spec public_asset_url(LC.Infra.ObjectStorage.storage_key()) ::
          {:ok, String.t()} | {:error, term()}
  def public_asset_url(key) when is_binary(key) do
    with :ok <- validate_storage_key(key),
         {:ok, config} <- fetch_config(),
         {:ok, public_url} <- build_object_url(config.public_base_url, key) do
      {:ok, public_url}
    end
  end

  def public_asset_url(_key), do: {:error, :invalid_storage_key}

  @spec upload_expiration(pos_integer()) :: {:ok, DateTime.t()}
  defp upload_expiration(upload_ttl_seconds) do
    expires_at =
      DateTime.utc_now()
      |> DateTime.add(upload_ttl_seconds, :second)
      |> DateTime.truncate(:second)

    {:ok, expires_at}
  end

  @spec fetch_config() :: {:ok, adapter_config()} | {:error, :invalid_config}
  defp fetch_config do
    with {:ok, upload_base_url} <- fetch_base_url(:upload_base_url),
         {:ok, public_base_url} <- fetch_base_url(:public_base_url),
         {:ok, upload_ttl_seconds} <- fetch_upload_ttl_seconds() do
      {:ok,
       %{
         upload_base_url: upload_base_url,
         public_base_url: public_base_url,
         upload_ttl_seconds: upload_ttl_seconds
       }}
    end
  end

  @spec fetch_base_url(:upload_base_url | :public_base_url) ::
          {:ok, String.t()} | {:error, :invalid_config}
  defp fetch_base_url(key) do
    config = Application.get_env(:live_canvas, __MODULE__, [])

    with value when is_binary(value) <- Keyword.get(config, key),
         {:ok, normalized_value} <- normalize_base_url(value) do
      {:ok, normalized_value}
    else
      _ -> {:error, :invalid_config}
    end
  end

  @spec fetch_upload_ttl_seconds() :: {:ok, pos_integer()} | {:error, :invalid_config}
  defp fetch_upload_ttl_seconds do
    config = Application.get_env(:live_canvas, __MODULE__, [])

    case Keyword.get(config, :upload_ttl_seconds, @default_upload_ttl_seconds) do
      value when is_integer(value) and value > 0 -> {:ok, value}
      _other -> {:error, :invalid_config}
    end
  end

  @spec normalize_base_url(String.t()) :: {:ok, String.t()} | {:error, :invalid_config}
  defp normalize_base_url(url) do
    uri = URI.parse(url)

    if uri.scheme == "https" and is_binary(uri.host) and uri.host != "" and is_nil(uri.query) and
         is_nil(uri.fragment) do
      {:ok, String.trim_trailing(url, "/")}
    else
      {:error, :invalid_config}
    end
  end

  @spec build_object_url(String.t(), LC.Infra.ObjectStorage.storage_key()) ::
          {:ok, String.t()} | {:error, :invalid_storage_key}
  defp build_object_url(base_url, key) do
    with :ok <- validate_storage_key(key) do
      normalized_key = String.trim_leading(key, "/")
      {:ok, "#{base_url}/#{normalized_key}"}
    end
  end

  @spec validate_storage_key(LC.Infra.ObjectStorage.storage_key()) ::
          :ok | {:error, :invalid_storage_key}
  defp validate_storage_key(key) when is_binary(key) do
    if String.starts_with?(key, "uploads/") and not String.contains?(key, "..") do
      :ok
    else
      {:error, :invalid_storage_key}
    end
  end
end
