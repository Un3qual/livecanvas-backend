defmodule LCWeb.PageHTML do
  @moduledoc """
  Page templates live under `page_html` so the controller remains a thin route
  boundary.
  """
  use LCWeb, :html

  embed_templates "page_html/*"
end
