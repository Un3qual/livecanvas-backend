import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/live_canvas start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :live_canvas, LCWeb.Endpoint, server: true
end

config :live_canvas, LCWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

parse_boolean_env = fn env_name, default ->
  case System.get_env(env_name) do
    nil ->
      default

    value when value in ~w(1 true TRUE yes YES on ON) ->
      true

    value when value in ~w(0 false FALSE no NO off OFF) ->
      false

    _other ->
      raise """
      environment variable #{env_name} must be one of true/false, 1/0, yes/no, or on/off.
      """
  end
end

metrics_endpoint_enabled = parse_boolean_env.("METRICS_ENDPOINT_ENABLED", false)
metrics_endpoint_token = System.get_env("METRICS_ENDPOINT_TOKEN")

if metrics_endpoint_enabled and
     not (is_binary(metrics_endpoint_token) and String.trim(metrics_endpoint_token) != "") do
  raise """
  environment variable METRICS_ENDPOINT_TOKEN is required when METRICS_ENDPOINT_ENABLED is true.
  """
end

config :live_canvas, LCWeb.Plugs.MetricsAuth,
  enabled: metrics_endpoint_enabled,
  token: metrics_endpoint_token

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :live_canvas, LC.Infra.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :live_canvas, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :live_canvas, LCWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base

  object_storage_upload_signing_url =
    System.get_env("OBJECT_STORAGE_UPLOAD_SIGNING_URL") ||
      raise """
      environment variable OBJECT_STORAGE_UPLOAD_SIGNING_URL is missing.
      For example: https://storage-api.example.com/upload-tickets
      """

  object_storage_upload_signing_authorization_header =
    case System.get_env("OBJECT_STORAGE_UPLOAD_SIGNING_AUTHORIZATION_HEADER") do
      value when is_binary(value) and value != "" -> value
      _other -> nil
    end

  object_storage_public_base_url =
    System.get_env("OBJECT_STORAGE_PUBLIC_BASE_URL") ||
      raise """
      environment variable OBJECT_STORAGE_PUBLIC_BASE_URL is missing.
      For example: https://cdn.example.com/media
      """

  object_storage_verification_base_url =
    System.get_env("OBJECT_STORAGE_VERIFICATION_BASE_URL") ||
      raise """
      environment variable OBJECT_STORAGE_VERIFICATION_BASE_URL is missing.
      For example: https://storage-api.example.com/objects
      """

  object_storage_verification_authorization_header =
    case System.get_env("OBJECT_STORAGE_VERIFICATION_AUTHORIZATION_HEADER") do
      value when is_binary(value) and value != "" -> value
      _other -> nil
    end

  object_storage_upload_ttl_seconds =
    case Integer.parse(System.get_env("OBJECT_STORAGE_UPLOAD_TTL_SECONDS", "900")) do
      {value, ""} when value > 0 ->
        value

      _ ->
        raise """
        environment variable OBJECT_STORAGE_UPLOAD_TTL_SECONDS must be a positive integer.
        For example: 900
        """
    end

  config :live_canvas, LC.Infra.ObjectStorage, adapter: LC.Infra.ObjectStorage.ConfigurableAdapter

  config :live_canvas, LC.Infra.ObjectStorage.ConfigurableAdapter,
    upload_signing_url: object_storage_upload_signing_url,
    upload_signing_authorization_header: object_storage_upload_signing_authorization_header,
    verification_base_url: object_storage_verification_base_url,
    verification_authorization_header: object_storage_verification_authorization_header,
    public_base_url: object_storage_public_base_url,
    upload_ttl_seconds: object_storage_upload_ttl_seconds

  parse_csv_env = fn env_name, default_values ->
    env_name
    |> System.get_env(Enum.join(default_values, ","))
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  fetch_provider_audiences = fn env_name, provider_label ->
    case parse_csv_env.(env_name, []) do
      [_ | _] = audiences ->
        audiences

      [] ->
        raise """
        environment variable #{env_name} is missing.
        Provide one or more #{provider_label} OIDC audiences as a comma-separated list.
        """
    end
  end

  config :live_canvas, LC.Accounts.ProviderAuth.Google,
    audiences: fetch_provider_audiences.("GOOGLE_OIDC_AUDIENCES", "Google"),
    issuers:
      parse_csv_env.("GOOGLE_OIDC_ISSUERS", [
        "https://accounts.google.com",
        "accounts.google.com"
      ]),
    jwks_url: System.get_env("GOOGLE_OIDC_JWKS_URL", "https://www.googleapis.com/oauth2/v3/certs")

  config :live_canvas, LC.Accounts.ProviderAuth.Apple,
    audiences: fetch_provider_audiences.("APPLE_OIDC_AUDIENCES", "Apple"),
    issuers: parse_csv_env.("APPLE_OIDC_ISSUERS", ["https://appleid.apple.com"]),
    jwks_url: System.get_env("APPLE_OIDC_JWKS_URL", "https://appleid.apple.com/auth/keys")

  config :live_canvas, LC.Accounts.Passkeys,
    origin: parse_csv_env.("PASSKEY_ORIGINS", ["https://#{host}"]),
    rp_id: System.get_env("PASSKEY_RP_ID", host),
    rp_name: System.get_env("PASSKEY_RP_NAME", "LiveCanvas")

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :live_canvas, LCWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :live_canvas, LCWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.

  # ## Configuring the mailer
  #
  # In production you need to configure the mailer to use a different adapter.
  # Here is an example configuration for Mailgun:
  #
  #     config :live_canvas, LC.Infra.Mailer,
  #       adapter: Swoosh.Adapters.Mailgun,
  #       api_key: System.get_env("MAILGUN_API_KEY"),
  #       domain: System.get_env("MAILGUN_DOMAIN")
  #
  # Most non-SMTP adapters require an API client. Swoosh supports Req, Hackney,
  # and Finch out-of-the-box. This configuration is typically done at
  # compile-time in your config/prod.exs:
  #
  #     config :swoosh, :api_client, Swoosh.ApiClient.Req
  #
  # See https://hexdocs.pm/swoosh/Swoosh.html#module-installation for details.
end
