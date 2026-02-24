defmodule LiveCanvasGQL do
  def document_providers(_) do
    [Absinthe.Plug.DocumentProvider.Default]
  end
end
