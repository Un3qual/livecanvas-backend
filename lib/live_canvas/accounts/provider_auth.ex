defmodule LC.Accounts.ProviderAuth do
  @moduledoc false

  alias __MODULE__.{Apple, Google, JwksCache}

  @default_jwks_cache_ttl_seconds 300

  @type provider :: :google | :apple
  @type verified_identity :: %{
          required(:provider) => :google_provider | :apple_provider,
          required(:provider_uid) => String.t(),
          required(:email) => String.t(),
          required(:provider_data) => map()
        }
  @type verify_result :: {:ok, verified_identity()} | {:error, :provider_verification_failed}
  @type verifier_opts :: keyword()

  @callback verify_id_token(String.t(), verifier_opts()) :: verify_result()

  @spec verify(provider(), String.t(), verifier_opts()) :: verify_result()
  def verify(provider, id_token, opts \\ [])

  def verify(:google, id_token, opts) when is_binary(id_token) and is_list(opts) do
    Google.verify_id_token(id_token, opts)
  end

  def verify(:apple, id_token, opts) when is_binary(id_token) and is_list(opts) do
    Apple.verify_id_token(id_token, opts)
  end

  def verify(_provider, _id_token, _opts), do: {:error, :provider_verification_failed}

  @doc false
  @spec fetch_config(module(), keyword()) ::
          {:ok, %{audiences: [String.t()], issuers: [String.t()], jwks_url: String.t()}}
          | {:error, :provider_verification_failed}
  def fetch_config(module, opts) when is_atom(module) and is_list(opts) do
    config =
      :live_canvas
      |> Application.get_env(module, [])
      |> Keyword.merge(opts)

    with {:ok, audiences} <- fetch_string_list(config, :audiences),
         {:ok, issuers} <- fetch_string_list(config, :issuers),
         {:ok, jwks_url} <- fetch_string(config, :jwks_url) do
      optional_config =
        [http_get: Keyword.get(config, :http_get), now: Keyword.get(config, :now)]
        |> Enum.reject(fn {_key, value} -> is_nil(value) end)
        |> Map.new()

      {:ok,
       Map.merge(optional_config, %{audiences: audiences, issuers: issuers, jwks_url: jwks_url})}
    end
  end

  @doc false
  @spec verify_rs256_id_token(String.t(), keyword()) ::
          {:ok, map()} | {:error, :provider_verification_failed}
  def verify_rs256_id_token(id_token, opts) when is_binary(id_token) and is_list(opts) do
    with {:ok, header, claims, signing_input, signature} <- decode_compact_token(id_token),
         :ok <- validate_header(header),
         {:ok, kid} <- fetch_kid(header),
         {:ok, signing_key} <- fetch_signing_key(kid, opts),
         {:ok, public_key} <- public_key_from_jwk(signing_key),
         true <- :public_key.verify(signing_input, :sha256, signature, public_key),
         :ok <- validate_registered_claims(claims, opts) do
      {:ok, claims}
    else
      _other -> {:error, :provider_verification_failed}
    end
  end

  @spec fetch_string_list(keyword(), atom()) ::
          {:ok, [String.t()]} | {:error, :provider_verification_failed}
  defp fetch_string_list(config, key) when is_list(config) and is_atom(key) do
    values = Keyword.get(config, key, [])

    if is_list(values) and values != [] and Enum.all?(values, &valid_string?/1) do
      {:ok, Enum.map(values, &String.trim/1)}
    else
      {:error, :provider_verification_failed}
    end
  end

  defp fetch_string(config, key) when is_list(config) and is_atom(key) do
    case Keyword.get(config, key) do
      value when is_binary(value) ->
        if valid_string?(value) do
          {:ok, String.trim(value)}
        else
          {:error, :provider_verification_failed}
        end

      _other ->
        {:error, :provider_verification_failed}
    end
  end

  defp decode_compact_token(id_token) when is_binary(id_token) do
    case String.split(id_token, ".", parts: 3) do
      [encoded_header, encoded_claims, encoded_signature] ->
        with {:ok, header} <- decode_json_segment(encoded_header),
             {:ok, claims} <- decode_json_segment(encoded_claims),
             {:ok, signature} <- Base.url_decode64(encoded_signature, padding: false) do
          {:ok, header, claims, "#{encoded_header}.#{encoded_claims}", signature}
        else
          _other -> {:error, :provider_verification_failed}
        end

      _other ->
        {:error, :provider_verification_failed}
    end
  end

  @spec decode_json_segment(String.t()) :: {:ok, map()} | {:error, :provider_verification_failed}
  defp decode_json_segment(segment) when is_binary(segment) do
    with {:ok, decoded_segment} <- Base.url_decode64(segment, padding: false),
         {:ok, decoded_json} <- Jason.decode(decoded_segment),
         true <- is_map(decoded_json) do
      {:ok, decoded_json}
    else
      _other -> {:error, :provider_verification_failed}
    end
  end

  @spec validate_header(map()) :: :ok | {:error, :provider_verification_failed}
  defp validate_header(%{"alg" => "RS256"}), do: :ok
  defp validate_header(_header), do: {:error, :provider_verification_failed}

  @spec fetch_kid(map()) :: {:ok, String.t()} | {:error, :provider_verification_failed}
  defp fetch_kid(%{"kid" => kid}) when is_binary(kid) do
    if valid_string?(kid) do
      {:ok, kid}
    else
      {:error, :provider_verification_failed}
    end
  end

  defp fetch_kid(_header), do: {:error, :provider_verification_failed}

  @spec fetch_signing_key(String.t(), keyword()) ::
          {:ok, map()} | {:error, :provider_verification_failed}
  defp fetch_signing_key(kid, opts) when is_binary(kid) and is_list(opts) do
    with {:ok, jwks_url} <- fetch_string(opts, :jwks_url),
         {:ok, %{"keys" => keys}} <- fetch_jwks(opts, jwks_url),
         %{} = key <- Enum.find(keys, &matches_kid?(&1, kid)) do
      {:ok, key}
    else
      _other -> {:error, :provider_verification_failed}
    end
  end

  @spec fetch_jwks(keyword(), String.t()) ::
          {:ok, map()} | {:error, :provider_verification_failed}
  defp fetch_jwks(opts, url) when is_list(opts) and is_binary(url) do
    now = Keyword.get(opts, :now, System.os_time(:second))

    case cached_jwks(url, now) do
      {:ok, jwks} ->
        {:ok, jwks}

      :miss ->
        with {:ok, jwks, ttl_seconds} <- http_get(opts, url) do
          cache_jwks(url, jwks, now + ttl_seconds)
          {:ok, jwks}
        end
    end
  end

  @spec http_get(keyword(), String.t()) ::
          {:ok, map(), pos_integer()} | {:error, :provider_verification_failed}
  defp http_get(opts, url) when is_list(opts) and is_binary(url) do
    http_get = Keyword.get(opts, :http_get) || (&default_http_get/1)

    case http_get.(url) do
      {:ok, response, ttl_seconds} when is_integer(ttl_seconds) and ttl_seconds > 0 ->
        normalize_jwks_response(response, ttl_seconds)

      {:ok, response} ->
        normalize_jwks_response(
          response,
          Keyword.get(opts, :jwks_cache_ttl_seconds, @default_jwks_cache_ttl_seconds)
        )

      _other ->
        {:error, :provider_verification_failed}
    end
  end

  defp default_http_get(url) when is_binary(url) do
    case Req.get(url: url) do
      {:ok, %Req.Response{status: 200, body: body, headers: headers}} when is_map(body) ->
        {:ok, stringify_map_keys(body), cache_ttl_seconds(headers)}

      {:ok, %Req.Response{status: 200, body: body, headers: headers}} when is_binary(body) ->
        case Jason.decode(body) do
          {:ok, decoded_body} when is_map(decoded_body) ->
            {:ok, stringify_map_keys(decoded_body), cache_ttl_seconds(headers)}

          _other ->
            {:error, :provider_verification_failed}
        end

      _other ->
        {:error, :provider_verification_failed}
    end
  end

  @spec matches_kid?(map(), String.t()) :: boolean()
  defp matches_kid?(%{"kid" => key_kid}, kid) when is_binary(key_kid), do: key_kid == kid
  defp matches_kid?(_key, _kid), do: false

  @spec public_key_from_jwk(map()) ::
          {:ok, {:RSAPublicKey, pos_integer(), pos_integer()}}
          | {:error, :provider_verification_failed}
  defp public_key_from_jwk(%{"e" => exponent, "kty" => "RSA", "n" => modulus}) do
    with {:ok, decoded_modulus} <- decode_unsigned(modulus),
         {:ok, decoded_exponent} <- decode_unsigned(exponent) do
      {:ok, {:RSAPublicKey, decoded_modulus, decoded_exponent}}
    end
  end

  defp public_key_from_jwk(_jwk), do: {:error, :provider_verification_failed}

  @spec decode_unsigned(String.t()) ::
          {:ok, pos_integer()} | {:error, :provider_verification_failed}
  defp decode_unsigned(value) when is_binary(value) do
    with {:ok, decoded_value} <- Base.url_decode64(value, padding: false),
         true <- byte_size(decoded_value) > 0 do
      {:ok, :binary.decode_unsigned(decoded_value)}
    else
      _other -> {:error, :provider_verification_failed}
    end
  end

  @spec validate_registered_claims(map(), keyword()) ::
          :ok | {:error, :provider_verification_failed}
  defp validate_registered_claims(claims, opts) when is_map(claims) and is_list(opts) do
    with {:ok, issuers} <- fetch_string_list(opts, :issuers),
         {:ok, audiences} <- fetch_string_list(opts, :audiences),
         {:ok, issuer} <- fetch_claim(claims, "iss"),
         true <- issuer in issuers,
         {:ok, subject} <- fetch_claim(claims, "sub"),
         true <- valid_string?(subject),
         :ok <- validate_audience(claims["aud"], audiences),
         :ok <-
           validate_expiration(claims["exp"], Keyword.get(opts, :now, System.os_time(:second))) do
      :ok
    else
      _other -> {:error, :provider_verification_failed}
    end
  end

  @spec fetch_claim(map(), String.t()) ::
          {:ok, String.t()} | {:error, :provider_verification_failed}
  defp fetch_claim(claims, key) when is_map(claims) and is_binary(key) do
    case Map.get(claims, key) do
      value when is_binary(value) ->
        if valid_string?(value) do
          {:ok, String.trim(value)}
        else
          {:error, :provider_verification_failed}
        end

      _other ->
        {:error, :provider_verification_failed}
    end
  end

  @spec validate_audience(String.t() | [String.t()] | nil, [String.t()]) ::
          :ok | {:error, :provider_verification_failed}
  defp validate_audience(audience, accepted_audiences) when is_binary(audience) do
    if audience in accepted_audiences do
      :ok
    else
      {:error, :provider_verification_failed}
    end
  end

  defp validate_audience(audiences, accepted_audiences) when is_list(audiences) do
    if Enum.any?(audiences, &(&1 in accepted_audiences)) do
      :ok
    else
      {:error, :provider_verification_failed}
    end
  end

  defp validate_audience(_audience, _accepted_audiences),
    do: {:error, :provider_verification_failed}

  @spec validate_expiration(integer() | nil, integer()) ::
          :ok | {:error, :provider_verification_failed}
  defp validate_expiration(expiration, now)
       when is_integer(expiration) and is_integer(now) and expiration > now,
       do: :ok

  defp validate_expiration(_expiration, _now), do: {:error, :provider_verification_failed}

  @spec stringify_map_keys(map()) :: map()
  defp stringify_map_keys(map) when is_map(map) do
    Map.new(map, fn {key, value} ->
      normalized_key = if is_atom(key), do: Atom.to_string(key), else: key

      normalized_value =
        cond do
          is_map(value) -> stringify_map_keys(value)
          is_list(value) -> Enum.map(value, &stringify_nested_value/1)
          true -> value
        end

      {normalized_key, normalized_value}
    end)
  end

  @spec stringify_nested_value(term()) :: term()
  defp stringify_nested_value(value) when is_map(value), do: stringify_map_keys(value)
  defp stringify_nested_value(value), do: value

  @spec normalize_jwks_response(map(), pos_integer()) ::
          {:ok, map(), pos_integer()} | {:error, :provider_verification_failed}
  defp normalize_jwks_response(%{"keys" => [_ | _]} = jwks, ttl_seconds)
       when is_integer(ttl_seconds) and ttl_seconds > 0,
       do: {:ok, jwks, ttl_seconds}

  defp normalize_jwks_response(%{keys: [_ | _]} = jwks, ttl_seconds)
       when is_integer(ttl_seconds) and ttl_seconds > 0,
       do: {:ok, stringify_map_keys(jwks), ttl_seconds}

  defp normalize_jwks_response(_response, _ttl_seconds),
    do: {:error, :provider_verification_failed}

  defp cache_ttl_seconds(headers) do
    if is_list(headers) do
      case Enum.find_value(headers, &header_cache_ttl_seconds/1) do
        nil -> @default_jwks_cache_ttl_seconds
        ttl_seconds -> ttl_seconds
      end
    else
      @default_jwks_cache_ttl_seconds
    end
  end

  @spec header_cache_ttl_seconds(term()) :: pos_integer() | nil
  defp header_cache_ttl_seconds({key, value}) when is_binary(key) do
    if String.downcase(key) == "cache-control" do
      parse_cache_control_ttl(value)
    end
  end

  defp header_cache_ttl_seconds(_header), do: nil

  @spec parse_cache_control_ttl(String.t() | [String.t()] | term()) :: pos_integer() | nil
  defp parse_cache_control_ttl(values) when is_list(values) do
    Enum.find_value(values, &parse_cache_control_ttl/1)
  end

  defp parse_cache_control_ttl(value) when is_binary(value) do
    case Regex.run(~r/max-age=(\d+)/, value) do
      [_, ttl_seconds] ->
        case Integer.parse(ttl_seconds) do
          {parsed_ttl_seconds, ""} when parsed_ttl_seconds > 0 -> parsed_ttl_seconds
          _other -> nil
        end

      _other ->
        nil
    end
  end

  defp parse_cache_control_ttl(_value), do: nil

  @spec cached_jwks(String.t(), integer()) :: {:ok, map()} | :miss
  defp cached_jwks(url, now) when is_binary(url) and is_integer(now) do
    JwksCache.fetch(url, now)
  end

  @spec cache_jwks(String.t(), map(), integer()) :: true
  defp cache_jwks(url, jwks, expires_at)
       when is_binary(url) and is_map(jwks) and is_integer(expires_at) do
    JwksCache.put(url, jwks, expires_at)
  end

  @spec valid_string?(term()) :: boolean()
  defp valid_string?(value) when is_binary(value), do: String.trim(value) != ""
  defp valid_string?(_value), do: false
end
