defmodule LiveCanvasWeb.PageController do
  use LiveCanvasWeb, :controller

  @spec home(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def home(conn, _params) do
    render(conn, :home)
  end
end
