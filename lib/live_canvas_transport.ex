defmodule LCTransport do
  @moduledoc false

  use Boundary,
    top_level?: true,
    deps: [],
    exports: [BearerAuth, LiveSessionReasons, LiveSessionTopics]
end
