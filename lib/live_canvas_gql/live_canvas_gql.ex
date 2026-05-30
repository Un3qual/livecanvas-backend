defmodule LCGQL do
  use Boundary, top_level?: true, deps: [LC, LCTransport, LCSchemas], exports: [Schema, Router]

  @spec document_providers(term()) :: nonempty_list(Absinthe.Plug.DocumentProvider.Default)
  def document_providers(_) do
    [Absinthe.Plug.DocumentProvider.Default]
  end
end
