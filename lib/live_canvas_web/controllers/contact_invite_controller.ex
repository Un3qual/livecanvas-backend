defmodule LCWeb.ContactInviteController do
  use LCWeb, :controller

  @content_security_policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

  @spec show(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def show(conn, _params) do
    conn
    |> put_root_layout(false)
    |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("content-security-policy", @content_security_policy)
    |> put_resp_header("referrer-policy", "no-referrer")
    |> render(:show)
  end
end
