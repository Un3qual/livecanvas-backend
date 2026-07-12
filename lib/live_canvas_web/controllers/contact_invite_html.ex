defmodule LCWeb.ContactInviteHTML do
  @moduledoc """
  Renders the public contact-invite handoff without receiving invite secrets.
  """
  use LCWeb, :html

  embed_templates "contact_invite_html/*"
end
