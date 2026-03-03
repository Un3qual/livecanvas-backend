defmodule LCWeb.Presence do
  @moduledoc false

  use Phoenix.Presence,
    otp_app: :live_canvas,
    pubsub_server: LC.PubSub
end
