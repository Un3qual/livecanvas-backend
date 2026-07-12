defmodule LC.Infra.ObjectStorage.ConfigurableAdapter do
  @moduledoc false

  @behaviour LC.Infra.ObjectStorage

  @default_upload_ttl_seconds 900
  @upload_method "PUT"
  @write_once_header "*"

  @type adapter_config :: %{
          upload_signing_url: String.t(),
          upload_signing_authorization_header: String.t() | nil,
          upload_signing_request_options: keyword(),
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
         {:ok, requested_expires_at} <- upload_expiration(config.upload_ttl_seconds),
         {:ok, response} <- request_upload_ticket(key, mime_type, requested_expires_at, config),
         {:ok, upload} <-
           validate_upload_ticket_response(response, key, mime_type, requested_expires_at) do
      {:ok, upload}
    else
      {:error, %_exception{}} -> {:error, :storage_unavailable}
      {:error, reason} -> {:error, reason}
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
    with {:ok, upload_signing_url} <- fetch_base_url(:upload_signing_url),
         {:ok, verification_base_url} <- fetch_base_url(:verification_base_url),
         {:ok, public_base_url} <- fetch_base_url(:public_base_url),
         {:ok, upload_ttl_seconds} <- fetch_upload_ttl_seconds() do
      {:ok,
       %{
         upload_signing_url: upload_signing_url,
         upload_signing_authorization_header:
           fetch_authorization_header(:upload_signing_authorization_header),
         upload_signing_request_options: fetch_request_options(:upload_signing_request_options),
         verification_base_url: verification_base_url,
         verification_authorization_header:
           fetch_authorization_header(:verification_authorization_header),
         verification_request_options: fetch_request_options(:verification_request_options),
         public_base_url: public_base_url,
         upload_ttl_seconds: upload_ttl_seconds
       }}
    end
  end

  @spec fetch_base_url(:upload_signing_url | :verification_base_url | :public_base_url) ::
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

  @spec fetch_authorization_header(
          :upload_signing_authorization_header
          | :verification_authorization_header
        ) :: String.t() | nil
  defp fetch_authorization_header(key) do
    config = Application.get_env(:live_canvas, __MODULE__, [])

    case Keyword.get(config, key) do
      value when is_binary(value) and value != "" -> value
      _other -> nil
    end
  end

  @spec fetch_request_options(:upload_signing_request_options | :verification_request_options) ::
          keyword()
  defp fetch_request_options(key) do
    config = Application.get_env(:live_canvas, __MODULE__, [])

    case Keyword.get(config, key, []) do
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

  @spec request_upload_ticket(String.t(), String.t(), DateTime.t(), adapter_config()) ::
          {:ok, Req.Response.t()} | {:error, Exception.t()}
  defp request_upload_ticket(key, mime_type, expires_at, config) do
    required_headers = required_upload_headers(mime_type)

    options =
      config.upload_signing_request_options
      |> Keyword.merge(
        url: config.upload_signing_url,
        headers: authorization_headers(config.upload_signing_authorization_header),
        json: %{
          key: key,
          method: @upload_method,
          content_type: mime_type,
          expires_at: DateTime.to_iso8601(expires_at),
          required_headers: required_headers,
          write_once: true
        },
        retry: false
      )

    Req.post(options)
  end

  @spec validate_upload_ticket_response(Req.Response.t(), String.t(), String.t(), DateTime.t()) ::
          {:ok, LC.Infra.ObjectStorage.signed_upload()} | {:error, atom()}
  defp validate_upload_ticket_response(
         %Req.Response{status: status},
         _key,
         _mime_type,
         _requested_expires_at
       )
       when status < 200 or status >= 300,
       do: {:error, :storage_unavailable}

  defp validate_upload_ticket_response(
         %Req.Response{body: body},
         key,
         mime_type,
         requested_expires_at
       )
       when is_map(body) do
    with :ok <- upload_ticket_key(Map.get(body, "key"), key),
         {:ok, method} <- upload_ticket_method(Map.get(body, "method")),
         {:ok, url} <- upload_ticket_url(Map.get(body, "url")),
         {:ok, headers} <- upload_ticket_headers(Map.get(body, "headers"), mime_type),
         {:ok, expires_at} <-
           upload_ticket_expiration(Map.get(body, "expires_at"), requested_expires_at) do
      {:ok, %{method: method, url: url, headers: headers, expires_at: expires_at}}
    end
  end

  defp validate_upload_ticket_response(_response, _key, _mime_type, _requested_expires_at),
    do: {:error, :invalid_upload_ticket}

  @spec upload_ticket_key(term(), String.t()) :: :ok | {:error, :invalid_upload_ticket}
  defp upload_ticket_key(key, key), do: :ok
  defp upload_ticket_key(_ticket_key, _requested_key), do: {:error, :invalid_upload_ticket}

  @spec upload_ticket_method(term()) :: {:ok, :put} | {:error, :invalid_upload_ticket}
  defp upload_ticket_method("PUT"), do: {:ok, :put}
  defp upload_ticket_method(_method), do: {:error, :invalid_upload_ticket}

  @spec upload_ticket_url(term()) :: {:ok, String.t()} | {:error, :invalid_upload_ticket}
  defp upload_ticket_url(url) when is_binary(url) do
    uri = URI.parse(url)

    if uri.scheme == "https" and is_binary(uri.host) and uri.host != "" and is_nil(uri.fragment) do
      {:ok, url}
    else
      {:error, :invalid_upload_ticket}
    end
  end

  defp upload_ticket_url(_url), do: {:error, :invalid_upload_ticket}

  @spec upload_ticket_headers(term(), String.t()) ::
          {:ok, %{optional(String.t()) => String.t()}} | {:error, :invalid_upload_ticket}
  defp upload_ticket_headers(headers, mime_type) when is_map(headers) do
    normalized_headers =
      Map.new(headers, fn
        {name, value} when is_binary(name) and is_binary(value) ->
          {String.downcase(String.trim(name)), value}

        _invalid_header ->
          {"", ""}
      end)

    required_headers = required_upload_headers(mime_type)

    if Map.take(normalized_headers, Map.keys(required_headers)) == required_headers and
         Enum.all?(normalized_headers, fn {name, value} -> name != "" and value != "" end) do
      {:ok, normalized_headers}
    else
      {:error, :invalid_upload_ticket}
    end
  end

  defp upload_ticket_headers(_headers, _mime_type), do: {:error, :invalid_upload_ticket}

  @spec upload_ticket_expiration(term(), DateTime.t()) ::
          {:ok, DateTime.t()} | {:error, :invalid_upload_ticket}
  defp upload_ticket_expiration(value, requested_expires_at) when is_binary(value) do
    now = DateTime.utc_now()

    with {:ok, expires_at, 0} <- DateTime.from_iso8601(value),
         :gt <- DateTime.compare(expires_at, now),
         comparison when comparison in [:lt, :eq] <-
           DateTime.compare(expires_at, requested_expires_at) do
      {:ok, expires_at}
    else
      _invalid_expiration -> {:error, :invalid_upload_ticket}
    end
  end

  defp upload_ticket_expiration(_value, _requested_expires_at),
    do: {:error, :invalid_upload_ticket}

  @spec required_upload_headers(String.t()) :: %{String.t() => String.t()}
  defp required_upload_headers(mime_type) do
    %{"content-type" => mime_type, "if-none-match" => @write_once_header}
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
      |> Keyword.merge(
        url: url,
        headers: authorization_headers(config.verification_authorization_header),
        retry: false
      )

    Req.head(options)
  end

  @spec authorization_headers(String.t() | nil) :: %{optional(String.t()) => String.t()}
  defp authorization_headers(nil), do: %{}

  defp authorization_headers(value) when is_binary(value) do
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
