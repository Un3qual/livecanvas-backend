defmodule LCGQL.Dataloader do
  @moduledoc false

  alias LC.{Accounts, Chat, Content, Live, Social}
  alias LC.Infra.Repo

  @source_names [Accounts, Chat, Content, Live, Social]

  @type request_context :: %{
          optional(:current_scope) => Accounts.Scope.t() | nil,
          optional(:auth_transport) => LCGQL.Context.auth_transport(),
          optional(:auth_error) => LCGQL.Context.auth_error()
        }

  @type source_context :: %{
          required(:current_scope) => Accounts.Scope.t() | nil,
          required(:auth_transport) => LCGQL.Context.auth_transport(),
          required(:auth_error) => LCGQL.Context.auth_error(),
          required(:request_ref) => reference()
        }

  @spec new(request_context()) :: Dataloader.t()
  def new(context) when is_map(context) do
    source_context = %{
      current_scope: Map.get(context, :current_scope),
      auth_transport: Map.get(context, :auth_transport, :none),
      auth_error: Map.get(context, :auth_error),
      request_ref: make_ref()
    }

    Enum.reduce(@source_names, Dataloader.new(), fn source_name, loader ->
      Dataloader.add_source(loader, source_name, new_source(source_context))
    end)
  end

  @spec new_source(source_context()) :: Dataloader.Ecto.t()
  defp new_source(source_context) do
    # Keep a per-request marker in source params so every GraphQL execution gets
    # isolated loader state even when viewer scope/auth metadata are identical.
    Dataloader.Ecto.new(Repo, default_params: source_context)
  end
end
