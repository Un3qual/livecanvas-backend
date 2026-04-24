defmodule LCSchemas.Content do
  @moduledoc false

  @type post_kind :: :standard | :story
  @type post_visibility :: :followers | :public
  @type media_processing_state :: :failed | :pending_upload | :processed | :uploaded
end
