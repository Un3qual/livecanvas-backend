defmodule LCWeb.Router do
  use LCWeb, :router

  import LCWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {LCWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_current_scope_for_user
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :public_html do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  scope "/", LCWeb do
    pipe_through :browser

    get "/", PageController, :home
  end

  scope "/", LCWeb do
    pipe_through :public_html

    get "/invites", ContactInviteController, :show
  end

  scope "/api", LCWeb do
    pipe_through :api

    post "/webhooks/media-processing", WebhookController, :media_processing
  end

  scope "/" do
    forward "/ops/metrics", LCWeb.Plugs.MetricsAuth
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:live_canvas, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: LCWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  ## Authentication routes

  scope "/", LCWeb do
    pipe_through [:browser, :redirect_if_user_is_authenticated]

    get "/users/register", UserRegistrationController, :new
    post "/users/register", UserRegistrationController, :create
    get "/users/reset-password", UserResetPasswordController, :new
    post "/users/reset-password", UserResetPasswordController, :create
    get "/users/reset-password/:token", UserResetPasswordController, :edit
    put "/users/reset-password/:token", UserResetPasswordController, :update
  end

  scope "/", LCWeb do
    pipe_through [:browser, :require_authenticated_user]

    get "/users/settings", UserSettingsController, :edit
    put "/users/settings", UserSettingsController, :update
    get "/users/settings/confirm-email/:token", UserSettingsController, :confirm_email
  end

  scope "/", LCWeb do
    pipe_through [:browser]

    get "/users/log-in", UserSessionController, :new
    get "/users/log-in/:token", UserSessionController, :confirm
    post "/users/log-in", UserSessionController, :create
    delete "/users/log-out", UserSessionController, :delete
  end
end
