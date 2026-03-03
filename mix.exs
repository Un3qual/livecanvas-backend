defmodule LiveCanvas.MixProject do
  use Mix.Project

  def project do
    [
      app: :live_canvas,
      version: "0.1.0",
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      compilers: [:boundary, :phoenix_live_view] ++ Mix.compilers(),
      listeners: [Phoenix.CodeReloader],
      dialyzer: [
        plt_file: {:no_warn, "_build/#{Mix.env()}/dialyzer.plt"},
        plt_add_apps: [:mix, :ex_unit],
        ignore_warnings: ".dialyzer_ignore.exs",
        list_unused_filters: true,
        flags: [:unmatched_returns, :error_handling, :underspecs]
      ]
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {LiveCanvasApp, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  def cli do
    [
      preferred_envs: [precommit: :test, typecheck: :dev, dialyzer: :dev]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps,
    do:
      List.flatten([
        phoenix_deps(),
        ecto_deps(),
        absinthe_deps(),
        test_deps(),
        js_deps(),
        misc_deps()
      ])

  defp phoenix_deps,
    do: [
      {:phoenix, "~> 1.8.3"},
      {:phoenix_ecto, "~> 4.5"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 1.1.0"},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:gettext, "~> 1.0"},
      {:argon2_elixir, "~> 4.0"}
    ]

  defp ecto_deps,
    do: [
      {:ecto_sql, "~> 3.13"},
      {:postgrex, ">= 0.0.0"}
    ]

  defp absinthe_deps,
    do: [
      {:absinthe, "~> 1.9"},
      {:absinthe_plug, "~> 1.5"},
      {:absinthe_phoenix, "~> 2.0"},
      {:absinthe_relay, "~> 1.6"},
      {:absinthe_error_payload, "~> 1.2"},
      {:wormwood, "~> 0.1.3"},
      {:dataloader, "~> 2.0"}
    ]

  defp test_deps,
    do: [
      {:lazy_html, ">= 0.1.0", only: :test},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false}
    ]

  defp js_deps,
    do: [
      {:esbuild, "~> 0.10", runtime: Mix.env() == :dev},
      {:tailwind, "~> 0.3", runtime: Mix.env() == :dev},
      {:heroicons,
       github: "tailwindlabs/heroicons",
       tag: "v2.2.0",
       sparse: "optimized",
       app: false,
       compile: false,
       depth: 1}
    ]

  defp misc_deps,
    do: [
      {:boundary, "~> 0.10", runtime: false},
      {:ecto_enum, "~> 1.4"},
      {:ex_phone_number, "~> 0.4.10"},
      {:swoosh, "~> 1.16"},
      {:req, "~> 0.5"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"},
      {:jason, "~> 1.2"},
      {:dns_cluster, "~> 0.2.0"},
      {:bandit, "~> 1.5"}
    ]

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "ecto.setup", "assets.setup", "assets.build"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
      typecheck: [
        "check.typespecs --strict",
        "dialyzer --format short"
      ],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["compile", "tailwind live_canvas", "esbuild live_canvas"],
      "assets.deploy": [
        "tailwind live_canvas --minify",
        "esbuild live_canvas --minify",
        "phx.digest"
      ],
      precommit: [
        "compile --warnings-as-errors",
        "deps.unlock --unused",
        "format",
        "test",
        "typecheck"
      ]
    ]
  end
end
