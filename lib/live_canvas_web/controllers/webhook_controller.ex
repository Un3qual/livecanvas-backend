defmodule LCWeb.WebhookController do
  use LCWeb, :controller

  alias LC.Content

  plug LCWeb.Plugs.WebhookSignature,
       [provider: :media_processing]
       when action in [:media_processing]

  @spec media_processing(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def media_processing(conn, params) when is_map(params) do
    with {:ok, event_id} <- event_id(conn),
         {:ok, result} <- Content.ingest_media_processing_webhook(event_id, params) do
      case result do
        :accepted ->
          conn
          |> put_status(:accepted)
          |> json(%{status: "accepted"})

        :duplicate ->
          conn
          |> put_status(:ok)
          |> json(%{status: "duplicate"})
      end
    else
      _reason ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid_payload"})
    end
  end

  @spec event_id(Plug.Conn.t()) :: {:ok, String.t()} | {:error, :missing_event_id}
  defp event_id(conn) do
    case Plug.Conn.get_req_header(conn, "x-livecanvas-event-id") do
      [event_id] when is_binary(event_id) and byte_size(event_id) > 0 ->
        {:ok, String.trim(event_id)}

      _ ->
        {:error, :missing_event_id}
    end
  end
end
