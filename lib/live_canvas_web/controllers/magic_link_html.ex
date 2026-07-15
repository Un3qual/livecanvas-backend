defmodule LCWeb.MagicLinkHTML do
  @moduledoc """
  Renders the public magic-link handoff without receiving auth credentials.
  """

  use LCWeb, :html

  embed_templates "magic_link_html/*"
end
