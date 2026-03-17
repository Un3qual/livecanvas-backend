defmodule LC.ProviderAuthTestSupport do
  @moduledoc false

  @type provider :: :google | :apple

  @spec provider_token_bundle(provider(), keyword()) :: %{
          token: String.t(),
          claims: map(),
          config: keyword()
        }
  def provider_token_bundle(provider, opts \\ []) when provider in [:google, :apple] do
    kid = Keyword.get(opts, :kid, "#{provider}-kid")
    issuer = Keyword.get(opts, :issuer, default_issuer(provider))
    audience = Keyword.get(opts, :audience, "#{provider}-client-id")
    jwks_url = Keyword.get(opts, :jwks_url, "https://#{provider}.example.com/oauth/jwks")

    claims =
      provider
      |> default_claims(issuer, audience)
      |> Map.merge(Map.new(Keyword.get(opts, :claims, %{})))

    private_key = :public_key.generate_key({:rsa, 1024, 65_537})
    public_key = {:RSAPublicKey, elem(private_key, 2), elem(private_key, 3)}

    jwks = %{
      "keys" => [
        %{
          "alg" => "RS256",
          "e" => encode_unsigned(elem(public_key, 2)),
          "kid" => kid,
          "kty" => "RSA",
          "n" => encode_unsigned(elem(public_key, 1)),
          "use" => "sig"
        }
      ]
    }

    http_get = fn
      ^jwks_url -> {:ok, jwks}
      _other_url -> {:error, :unexpected_jwks_url}
    end

    %{
      token: sign_token(private_key, kid, claims),
      claims: claims,
      config: [audiences: [audience], issuers: [issuer], jwks_url: jwks_url, http_get: http_get]
    }
  end

  @spec with_provider_configs(keyword(), (-> result)) :: result when result: var
  def with_provider_configs(configs, fun) when is_list(configs) and is_function(fun, 0) do
    previous =
      Enum.map(configs, fn {provider, config} ->
        module = provider_module(provider)
        {module, Application.get_env(:live_canvas, module), config}
      end)

    Enum.each(previous, fn {module, _previous_config, config} ->
      Application.put_env(:live_canvas, module, config)
    end)

    try do
      fun.()
    after
      Enum.each(previous, fn {module, previous_config, _config} ->
        if is_nil(previous_config) do
          Application.delete_env(:live_canvas, module)
        else
          Application.put_env(:live_canvas, module, previous_config)
        end
      end)
    end
  end

  @spec provider_module(provider()) :: module()
  def provider_module(:google), do: LC.Accounts.ProviderAuth.Google
  def provider_module(:apple), do: LC.Accounts.ProviderAuth.Apple

  @spec default_claims(provider(), String.t(), String.t()) :: map()
  defp default_claims(:google, issuer, audience) do
    %{
      "aud" => audience,
      "email" => "google-#{System.unique_integer([:positive])}@example.com",
      "email_verified" => true,
      "exp" => System.os_time(:second) + 3600,
      "iss" => issuer,
      "sub" => "google-subject-#{System.unique_integer([:positive])}"
    }
  end

  defp default_claims(:apple, issuer, audience) do
    %{
      "aud" => audience,
      "email" => "apple-#{System.unique_integer([:positive])}@example.com",
      "email_verified" => "true",
      "exp" => System.os_time(:second) + 3600,
      "iss" => issuer,
      "sub" => "apple-subject-#{System.unique_integer([:positive])}"
    }
  end

  @spec default_issuer(provider()) :: String.t()
  defp default_issuer(:google), do: "https://accounts.google.com"
  defp default_issuer(:apple), do: "https://appleid.apple.com"

  @spec sign_token(tuple(), String.t(), map()) :: String.t()
  defp sign_token(private_key, kid, claims) do
    encoded_header =
      %{"alg" => "RS256", "kid" => kid, "typ" => "JWT"}
      |> Jason.encode!()
      |> Base.url_encode64(padding: false)

    encoded_claims =
      claims
      |> Jason.encode!()
      |> Base.url_encode64(padding: false)

    signing_input = "#{encoded_header}.#{encoded_claims}"

    signature =
      signing_input
      |> :public_key.sign(:sha256, private_key)
      |> Base.url_encode64(padding: false)

    "#{signing_input}.#{signature}"
  end

  @spec encode_unsigned(pos_integer()) :: String.t()
  defp encode_unsigned(value) when is_integer(value) and value > 0 do
    value
    |> :binary.encode_unsigned()
    |> Base.url_encode64(padding: false)
  end
end
