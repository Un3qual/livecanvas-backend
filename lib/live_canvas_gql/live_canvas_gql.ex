defmodule LiveCanvasGQL do
  use Boundary, top_level?: true, deps: [LiveCanvas], exports: [Schema, Router]

  def document_providers(_) do
    [Absinthe.Plug.DocumentProvider.Default]
  end
end
