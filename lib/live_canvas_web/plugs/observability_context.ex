defmodule LCWeb.Plugs.ObservabilityContext do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn, only: [assign: 3, get_req_header: 2, get_resp_header: 2, put_resp_header: 3]

  require Logger

  @request_id_header "x-request-id"
  @trace_id_header "x-trace-id"
  @generated_request_id_bytes 15
  @generated_trace_id_bytes 16
  @safe_request_id ~r/\A[A-Za-z0-9_-]{20,200}\z/

  @type context :: %{
          request_id: String.t(),
          trace_id: String.t(),
          viewer_id: pos_integer() | nil,
          live_session_id: pos_integer() | nil
        }

  @impl Plug
  @spec init(term()) :: term()
  def init(opts), do: opts

  @impl Plug
  @spec call(Plug.Conn.t(), term()) :: Plug.Conn.t()
  def call(conn, _opts) do
    context = build_request_context(conn)

    Logger.metadata(logger_metadata(context))

    conn
    |> assign(:request_id, context.request_id)
    |> assign(:observability_context, context)
    |> put_resp_header(@request_id_header, context.request_id)
    |> put_resp_header(@trace_id_header, context.trace_id)
  end

  @spec build_request_context(Plug.Conn.t()) :: context()
  def build_request_context(conn) do
    %{
      request_id: request_id_from_conn(conn),
      trace_id: trace_id_from_conn(conn),
      viewer_id: nil,
      live_session_id: nil
    }
  end

  @spec build_socket_context(map(), pos_integer() | nil) :: context()
  def build_socket_context(params, viewer_id \\ nil) when is_map(params) do
    %{
      request_id: request_id_from_value(value_for(params, :request_id)),
      trace_id: trace_id_from_value(value_for(params, :trace_id)),
      viewer_id: viewer_id,
      live_session_id: nil
    }
  end

  @spec put_viewer_context(context(), pos_integer() | nil) :: context()
  def put_viewer_context(%{} = context, viewer_id)
      when is_nil(viewer_id) or is_integer(viewer_id) do
    %{context | viewer_id: viewer_id}
  end

  @spec put_live_session_context(context(), pos_integer() | nil) :: context()
  def put_live_session_context(%{} = context, live_session_id)
      when is_nil(live_session_id) or is_integer(live_session_id) do
    %{context | live_session_id: live_session_id}
  end

  @spec logger_metadata(context()) :: keyword()
  def logger_metadata(%{} = context) do
    context
    |> Map.take([:request_id, :trace_id, :viewer_id, :live_session_id])
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
  end

  @spec request_id_from_value(term()) :: String.t()
  defp request_id_from_value(value) do
    case normalize_request_id(value) do
      {:ok, request_id} -> request_id
      :error -> generate_request_id()
    end
  end

  @spec request_id_from_conn(Plug.Conn.t()) :: String.t()
  defp request_id_from_conn(conn) do
    conn.assigns[:request_id]
    |> case do
      nil ->
        conn
        |> first_header_value(@request_id_header)
        |> request_id_from_value()

      request_id ->
        request_id_from_value(request_id)
    end
  end

  @spec trace_id_from_conn(Plug.Conn.t()) :: String.t()
  defp trace_id_from_conn(conn) do
    conn
    |> first_header_value(@trace_id_header)
    |> trace_id_from_value()
  end

  @spec trace_id_from_value(term()) :: String.t()
  defp trace_id_from_value(value) do
    case normalize_trace_id(value) do
      {:ok, trace_id} -> trace_id
      :error -> generate_trace_id()
    end
  end

  @spec first_header_value(Plug.Conn.t(), String.t()) :: String.t() | nil
  defp first_header_value(conn, header_name) when is_binary(header_name) do
    case get_resp_header(conn, header_name) ++ get_req_header(conn, header_name) do
      [value | _rest] -> value
      [] -> nil
    end
  end

  @spec normalize_request_id(term()) :: {:ok, String.t()} | :error
  defp normalize_request_id(value) when is_binary(value) do
    normalized = String.trim(value)

    if Regex.match?(@safe_request_id, normalized) do
      {:ok, normalized}
    else
      :error
    end
  end

  defp normalize_request_id(_value), do: :error

  @spec normalize_trace_id(term()) :: {:ok, String.t()} | :error
  defp normalize_trace_id(value) when is_binary(value) do
    normalized = String.trim(value)

    cond do
      Regex.match?(~r/\A[0-9a-fA-F]{32}\z/, normalized) ->
        {:ok, String.downcase(normalized)}

      match?({:ok, _uuid}, Ecto.UUID.cast(normalized)) ->
        {:ok, normalized |> String.downcase() |> String.replace("-", "")}

      true ->
        :error
    end
  end

  defp normalize_trace_id(_value), do: :error

  @spec generate_request_id() :: String.t()
  defp generate_request_id do
    :crypto.strong_rand_bytes(@generated_request_id_bytes)
    |> Base.url_encode64(padding: false)
  end

  @spec generate_trace_id() :: String.t()
  defp generate_trace_id do
    @generated_trace_id_bytes
    |> :crypto.strong_rand_bytes()
    |> Base.encode16(case: :lower)
  end

  @spec value_for(map(), :request_id | :trace_id) :: term()
  defp value_for(values, :request_id) when is_map(values) do
    Map.get(values, :request_id) || Map.get(values, "request_id")
  end

  defp value_for(values, :trace_id) when is_map(values) do
    Map.get(values, :trace_id) || Map.get(values, "trace_id")
  end
end
