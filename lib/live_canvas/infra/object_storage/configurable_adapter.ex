defmodule LC.Infra.ObjectStorage.ConfigurableAdapter do
  @moduledoc false

  @behaviour LC.Infra.ObjectStorage

  @default_upload_ttl_seconds 900

  @type adapter_config :: %{
          upload_base_url: String.t(),
          verification_base_url: String.t(),
          verification_authorization_header: String.t() | nil,
          verification_request_options: keyword(),
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
         headers: %{"content-type" => mime_type, "if-none-match" => "*"},
         expires_at: expires_at
       }}
    end
  end

  def sign_upload(_request), do: {:error, :invalid_upload_request}

  @impl LC.Infra.ObjectStorage
  @spec verify_upload(LC.Infra.ObjectStorage.verification_request()) ::
          {:ok, LC.Infra.ObjectStorage.verified_upload()} | {:error, term()}
  def verify_upload(%{key: key, mime_type: mime_type, max_bytes: max_bytes})
      when is_binary(key) and is_binary(mime_type) and is_integer(max_bytes) and max_bytes > 0 do
    with :ok <- validate_storage_key(key),
         {:ok, config} <- fetch_config(),
         {:ok, verification_url} <- build_object_url(config.verification_base_url, key),
         {:ok, response} <- request_verification(verification_url, config),
         {:ok, verified_upload} <- validate_verification_response(response, mime_type, max_bytes) do
      {:ok, verified_upload}
    else
      {:error, %_exception{}} -> {:error, :storage_unavailable}
      {:error, reason} -> {:error, reason}
    end
  end

  def verify_upload(_request), do: {:error, :invalid_verification_request}

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
         {:ok, verification_base_url} <- fetch_base_url(:verification_base_url),
         {:ok, public_base_url} <- fetch_base_url(:public_base_url),
         {:ok, upload_ttl_seconds} <- fetch_upload_ttl_seconds() do
      {:ok,
       %{
         upload_base_url: upload_base_url,
         verification_base_url: verification_base_url,
         verification_authorization_header: fetch_verification_authorization_header(),
         verification_request_options: fetch_verification_request_options(),
         public_base_url: public_base_url,
         upload_ttl_seconds: upload_ttl_seconds
       }}
    end
  end

  @spec fetch_base_url(:upload_base_url | :verification_base_url | :public_base_url) ::
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

  @spec fetch_verification_authorization_header() :: String.t() | nil
  defp fetch_verification_authorization_header do
    config = Application.get_env(:live_canvas, __MODULE__, [])

    case Keyword.get(config, :verification_authorization_header) do
      value when is_binary(value) and value != "" -> value
      _other -> nil
    end
  end

  @spec fetch_verification_request_options() :: keyword()
  defp fetch_verification_request_options do
    config = Application.get_env(:live_canvas, __MODULE__, [])

    case Keyword.get(config, :verification_request_options, []) do
      options when is_list(options) -> options
      _other -> []
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

  @spec request_verification(String.t(), adapter_config()) ::
          {:ok, Req.Response.t()} | {:error, Exception.t()}
  defp request_verification(url, config) do
    options =
      config.verification_request_options
      |> Keyword.merge(url: url, headers: verification_headers(config), retry: false)

    Req.head(options)
  end

  @spec verification_headers(adapter_config()) :: %{optional(String.t()) => String.t()}
  defp verification_headers(%{verification_authorization_header: nil}), do: %{}

  defp verification_headers(%{verification_authorization_header: value}) when is_binary(value) do
    %{"authorization" => value}
  end

  @spec validate_verification_response(Req.Response.t(), String.t(), pos_integer()) ::
          {:ok, LC.Infra.ObjectStorage.verified_upload()} | {:error, atom()}
  defp validate_verification_response(%Req.Response{status: 404}, _mime_type, _max_bytes),
    do: {:error, :upload_not_found}

  defp validate_verification_response(%Req.Response{status: status}, _mime_type, _max_bytes)
       when status < 200 or status >= 300,
       do: {:error, :storage_unavailable}

  defp validate_verification_response(%Req.Response{} = response, mime_type, max_bytes) do
    with {:ok, content_length} <- parse_content_length(response),
         :ok <- validate_content_length(content_length, max_bytes),
         {:ok, content_type} <- parse_content_type(response),
         :ok <- validate_content_type(content_type, mime_type) do
      {:ok, %{content_length: content_length, content_type: content_type}}
    end
  end

  @spec parse_content_length(Req.Response.t()) ::
          {:ok, integer()} | {:error, :invalid_content_length}
  defp parse_content_length(response) do
    case Req.Response.get_header(response, "content-length") do
      [value] ->
        case Integer.parse(value) do
          {content_length, ""} -> {:ok, content_length}
          _other -> {:error, :invalid_content_length}
        end

      _other ->
        {:error, :invalid_content_length}
    end
  end

  @spec validate_content_length(integer(), pos_integer()) ::
          :ok | {:error, :empty_upload | :invalid_content_length | :upload_too_large}
  defp validate_content_length(0, _max_bytes), do: {:error, :empty_upload}

  defp validate_content_length(value, _max_bytes) when value < 0,
    do: {:error, :invalid_content_length}

  defp validate_content_length(value, max_bytes) when value > max_bytes,
    do: {:error, :upload_too_large}

  defp validate_content_length(_value, _max_bytes), do: :ok

  @spec parse_content_type(Req.Response.t()) :: {:ok, String.t()} | {:error, atom()}
  defp parse_content_type(response) do
    case Req.Response.get_header(response, "content-type") do
      [value] ->
        content_type =
          value |> String.split(";", parts: 2) |> hd() |> String.trim() |> String.downcase()

        if content_type == "" do
          {:error, :content_type_mismatch}
        else
          {:ok, content_type}
        end

      _other ->
        {:error, :content_type_mismatch}
    end
  end

  @spec validate_content_type(String.t(), String.t()) :: :ok | {:error, :content_type_mismatch}
  defp validate_content_type(actual, expected) do
    if actual == String.downcase(String.trim(expected)) do
      :ok
    else
      {:error, :content_type_mismatch}
    end
  end
end
