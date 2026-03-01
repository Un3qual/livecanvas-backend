defmodule LiveCanvasSchemas do
  @moduledoc false

  use Boundary, top_level?: true, exports: [User, UserToken]
end
