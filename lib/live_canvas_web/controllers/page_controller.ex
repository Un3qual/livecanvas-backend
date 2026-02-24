defmodule LiveCanvasWeb.PageController do
  use LiveCanvasWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
