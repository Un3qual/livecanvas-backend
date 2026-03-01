defmodule LiveCanvas do
  @moduledoc """
  LiveCanvas keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, regardless
  if it comes from the database, an external API or others.
  """

  @test_support_exports if Mix.env() == :test, do: [AccountsFixtures, DataCase], else: []

  use Boundary,
    top_level?: true,
    deps: [LiveCanvasSchemas],
    exports: [Accounts] ++ @test_support_exports

  def repo_module, do: LiveCanvas.Infra.Repo

  def local_mail_adapter? do
    Application.get_env(:live_canvas, LiveCanvas.Infra.Mailer)[:adapter] == Swoosh.Adapters.Local
  end
end
