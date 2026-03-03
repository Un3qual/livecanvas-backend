defmodule LC do
  @moduledoc """
  LC keeps the contexts that define your domain
  and business logic.

  Contexts are also responsible for managing your data, regardless
  if it comes from the database, an external API or others.
  """

  @test_support_exports if Mix.env() == :test,
                          do: [AccountsFixtures, ContentFixtures, DataCase, SocialFixtures],
                          else: []

  use Boundary,
    top_level?: true,
    deps: [LCSchemas],
    exports: [Accounts, Content, Social] ++ @test_support_exports

  @spec repo_module() :: LC.Infra.Repo
  def repo_module, do: LC.Infra.Repo

  @spec local_mail_adapter?() :: boolean()
  def local_mail_adapter? do
    Application.get_env(:live_canvas, LC.Infra.Mailer)[:adapter] == Swoosh.Adapters.Local
  end
end
