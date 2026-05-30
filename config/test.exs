import Config

# Only in tests, remove the complexity from the password hashing algorithm
config :argon2_elixir, t_cost: 1, m_cost: 8

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :live_canvas, LC.Infra.Repo,
  username: "postgres",
  password: "development",
  hostname: "localhost",
  database: "live_canvas_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :live_canvas, LCWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "dY7bs3jtluPV2OwwWQWe4hlzV5mIIcyhtxuQW4QyUp6iumSvTC9ujUG0/IYfKySy",
  server: false

config :live_canvas, LCWeb.Plugs.WebhookSignature,
  providers: [media_processing: "test-webhook-secret"],
  max_skew_seconds: 300

config :live_canvas, LC.Infra.AsyncJobs.Worker, enabled: false

# Keep explicit runtime lease defaults for tests so scenario tests can
# temporarily override these values and restore deterministic baselines.
config :live_canvas, LC.TestSupport.Live.PeerRuntimeHelper,
  rpc_timeout_ms: 5_000,
  peer_startup_timeout_ms: 15_000,
  peer_connect_attempts: 80,
  peer_poll_interval_ms: 25,
  cookie: :live_canvas_peer_runtime

# In test we don't send emails
config :live_canvas, LC.Infra.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true
