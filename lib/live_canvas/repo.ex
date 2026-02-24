defmodule LiveCanvas.Repo do
  use Ecto.Repo,
    otp_app: :live_canvas,
    adapter: Ecto.Adapters.Postgres
end
