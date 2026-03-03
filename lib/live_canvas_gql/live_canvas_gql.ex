defmodule LiveCanvasGQL do
  use Boundary, top_level?: true, deps: [LiveCanvas], exports: [Schema, Router]

  @spec document_providers(term()) :: nonempty_list(Absinthe.Plug.DocumentProvider.Default)
  def document_providers(_) do
    [Absinthe.Plug.DocumentProvider.Default]
  end
end
