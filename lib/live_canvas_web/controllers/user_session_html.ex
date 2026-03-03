defmodule LCWeb.UserSessionHTML do
  use LCWeb, :html

  embed_templates "user_session_html/*"

  defp local_mail_adapter? do
    LC.local_mail_adapter?()
  end
end
