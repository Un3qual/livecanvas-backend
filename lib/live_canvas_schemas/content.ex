defmodule LCSchemas.Content do
  @moduledoc false

  @type post_kind :: :standard
  @type post_visibility :: :followers | :public
  @type media_processing_state :: :failed | :processed | :uploaded
end
