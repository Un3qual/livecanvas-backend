# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :live_canvas, namespace: LC

config :live_canvas, LCGQL.Router, enable_graphiql: false

config :live_canvas, LC.RateLimiter,
  limits: [
    auth_login: [limit: 20, window_ms: 60_000],
    graphql_mutation: [limit: 120, window_ms: 60_000],
    moderation_action: [limit: 30, window_ms: 60_000],
    channel_join: [limit: 60, window_ms: 60_000],
    chat_send: [limit: 120, window_ms: 60_000],
    media_signal: [limit: 600, window_ms: 60_000]
  ]

config :live_canvas, LCWeb.Plugs.WebhookSignature,
  providers: [media_processing: "dev-webhook-secret"],
  max_skew_seconds: 300

config :live_canvas, LC.Infra.AsyncJobs.Worker,
  enabled: true,
  poll_interval_ms: 1_000,
  claim_limit: 20,
  handlers: %{
    "media_asset_processing" => LC.Content.MediaProcessingJob,
    "media_processing_webhook" => LC.Content.MediaProcessingJob,
    "data_export_request" => LC.Infra.DataGovernance.Export,
    "account_deletion_request" => LC.Infra.DataGovernance.Deletion
  }

config :live_canvas, LC.Infra.DataGovernance.Deletion,
  grace_period_seconds: 604_800,
  job_max_attempts: 3

config :live_canvas, LC.Infra.DataGovernance.Retention,
  family_cutoff_days: [
    auth_events: 365,
    async_jobs: 30,
    webhook_events: 90,
    live_session_timeline_events: 180,
    live_participants: 180
  ],
  apply_mode_enabled: false,
  incident_hold_active: false

config :live_canvas, LCWeb.Plugs.MetricsAuth,
  enabled: false,
  token: nil,
  reporter_name: :live_canvas_prometheus_metrics

config :live_canvas, :scopes,
  user: [
    default: true,
    module: LC.Accounts.Scope,
    assign_key: :current_scope,
    access_path: [:user, :id],
    schema_key: :user_id,
    schema_type: :id,
    schema_table: :users,
    test_data_fixture: LC.AccountsFixtures,
    test_setup_helper: :register_and_log_in_user
  ]

config :live_canvas,
  ecto_repos: [LC.Infra.Repo],
  generators: [timestamp_type: :utc_datetime_usec]

# Configure the endpoint
config :live_canvas, LCWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: LCWeb.ErrorHTML, json: LCWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: LC.PubSub,
  live_view: [signing_salt: "Fvq4bPHD"]

# Configure the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :live_canvas, LC.Infra.Mailer, adapter: Swoosh.Adapters.Local

config :live_canvas, LC.Content.MediaProcessing, adapter: LC.Content.MediaProcessing.FakeAdapter

config :live_canvas, LC.Live.MediaSignaling,
  provider: LC.Live.MediaSignaling.StaticIceServerProvider,
  provider_config: [
    ice_servers: [%{urls: ["stun:stun.l.google.com:19302"]}]
  ]

config :live_canvas, LC.Infra.ObjectStorage, adapter: LC.Infra.ObjectStorage.FakeAdapter

config :live_canvas, LC.Infra.ObjectStorage.ConfigurableAdapter,
  upload_ttl_seconds: 900,
  verification_request_options: []

config :live_canvas, LC.Infra.SMS, adapter: LC.Infra.SMS.FakeAdapter

config :live_canvas, LC.Accounts.ProviderAuth.Google,
  audiences: ["livecanvas-google-client-id"],
  issuers: ["https://accounts.google.com", "accounts.google.com"],
  jwks_url: "https://www.googleapis.com/oauth2/v3/certs"

config :live_canvas, LC.Accounts.ProviderAuth.Apple,
  audiences: ["livecanvas-apple-client-id"],
  issuers: ["https://appleid.apple.com"],
  jwks_url: "https://appleid.apple.com/auth/keys"

config :live_canvas, LC.Accounts.Passkeys,
  adapter: LC.Accounts.Passkeys.WaxAdapter,
  attestation: "none",
  origin: "https://livecanvas.invalid",
  rp_id: "livecanvas.invalid",
  rp_name: "LiveCanvas",
  user_verification: "preferred"

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.4",
  live_canvas: [
    args:
      ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.1.12",
  live_canvas: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/css/app.css
    ),
    cd: Path.expand("..", __DIR__)
  ]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :trace_id, :viewer_id, :live_session_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
