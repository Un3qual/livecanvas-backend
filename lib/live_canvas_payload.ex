defmodule LCPayload do
  @moduledoc false

  use Boundary,
    top_level?: true,
    exports: [Payload]
end
