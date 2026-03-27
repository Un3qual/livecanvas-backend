defmodule LCWeb.LiveSessionChannel do
  use LCWeb, :channel

  require Logger

  alias LC.{Chat, Live}
  alias LC.RateLimiter
  alias LCWeb.Plugs.ObservabilityContext
  alias Phoenix.Socket.Broadcast

  @disconnect_event "disconnect"

  @impl true
  @spec join(String.t(), map(), Phoenix.Socket.t()) ::
          {:ok, map(), Phoenix.Socket.t()} | {:error, map()}
  def join(
        "live_session:" <> raw_session_id,
        _params,
        %Phoenix.Socket{assigns: %{current_user: %{id: user_id} = current_user}} = socket
      ) do
    socket = ensure_observability_context(socket)
    session_id_hint = parse_session_id_hint(raw_session_id)

    result =
      with {:ok, session_id} <- parse_session_id(raw_session_id),
           true <- is_integer(user_id) || {:error, :not_authorized},
           :ok <- rate_limit_join(user_id),
           {:ok, live_session} <- Live.fetch_joinable_session(session_id),
           :ok <- Chat.authorize_join(current_user, live_session),
           {:ok, _participant} <- Live.join_live_session(live_session, current_user, :viewer),
           :ok <- subscribe_to_control_topics(session_id, user_id) do
        joined_socket =
          socket
          |> assign(:live_session, live_session)
          |> put_live_session_observability_context(session_id)

        :ok = broadcast_session_state(session_id, live_session)

        {:ok, joined_socket, session_id}
      else
        {:error, reason} -> {:error, reason}
      end

    case result do
      {:ok, joined_socket, session_id} ->
        :ok =
          emit_channel_telemetry(
            :join,
            socket_telemetry_metadata(joined_socket),
            {:ok, :joined}
          )

        {:ok, published_session_state(session_id, joined_socket.assigns.live_session),
         joined_socket}

      {:error, reason} ->
        :ok =
          emit_channel_telemetry(
            :join,
            Map.put(socket_telemetry_metadata(socket), :session_id, session_id_hint),
            {:error, reason}
          )

        {:error, %{reason: join_error_reason(reason)}}
    end
  end

  def join("live_session:" <> raw_session_id, _params, socket) do
    socket = ensure_observability_context(socket)

    :ok =
      emit_channel_telemetry(
        :join,
        Map.put(socket_telemetry_metadata(socket), :session_id, parse_session_id_hint(raw_session_id)),
        {:error, :not_authorized}
      )

    {:error, %{reason: join_error_reason(:not_authorized)}}
  end

  @impl true
  @spec handle_info(Broadcast.t(), Phoenix.Socket.t()) :: {:stop, term(), Phoenix.Socket.t()}
  def handle_info(%Broadcast{event: @disconnect_event}, socket) do
    {:stop, :session_disconnected, socket}
  end

  @impl true
  @spec handle_out(String.t(), map(), Phoenix.Socket.t()) :: {:noreply, Phoenix.Socket.t()}
  def handle_out(event, payload, socket) when is_binary(event) and is_map(payload) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  @impl true
  @spec handle_in(String.t(), map(), Phoenix.Socket.t()) ::
          {:reply, {:error | :ok, map()}, Phoenix.Socket.t()}
  def handle_in(
        "chat:send",
        %{"body" => body},
        %Phoenix.Socket{
          assigns: %{
            current_user: %{id: user_id} = current_user,
            live_session: %{id: live_session_id} = live_session
          }
        } = socket
      )
      when is_binary(body) do
    socket = ensure_observability_context(socket)

    result =
      with true <-
             (is_integer(user_id) && is_integer(live_session_id)) || {:error, :not_authorized},
           :ok <- rate_limit_chat_send(user_id, live_session_id),
           {:ok, chat_message} <-
             Chat.create_message(live_session, current_user, %{body: body}) do
        {:ok, %{message: Chat.message_payload(chat_message)}}
      else
        {:error, reason} -> {:error, reason}
      end

    :ok =
      emit_channel_telemetry(
        :chat_send,
        socket_telemetry_metadata(socket),
        result
      )

    case result do
      {:ok, payload} ->
        broadcast!(socket, "chat:message", payload)
        {:reply, {:ok, payload}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: message_error_reason(reason)}}, socket}
    end
  end

  def handle_in("chat:send", _payload, socket) do
    socket = ensure_observability_context(socket)

    :ok =
      emit_channel_telemetry(
        :chat_send,
        socket_telemetry_metadata(socket),
        {:error, :invalid_body}
      )

    {:reply, {:error, %{reason: message_error_reason(:invalid_body)}}, socket}
  end

  @impl true
  @spec terminate(term(), Phoenix.Socket.t()) :: :ok
  def terminate(
        _reason,
        %Phoenix.Socket{assigns: %{current_user: current_user, live_session: live_session}}
      )
      when is_map(current_user) and is_map(live_session) do
    # Disconnect cleanup is best-effort because channel termination can race
    # against session shutdown; `LC.Live` handles idempotent reconciliation.
    safe_leave_live_session(live_session, current_user)
    :ok = maybe_broadcast_session_state(live_session)
    :ok
  end

  def terminate(_reason, _socket), do: :ok

  defp parse_session_id(raw_session_id) do
    case Integer.parse(raw_session_id) do
      {session_id, ""} when session_id > 0 -> {:ok, session_id}
      _ -> {:error, :invalid_session_id}
    end
  end

  @spec parse_session_id_hint(String.t()) :: pos_integer() | nil
  defp parse_session_id_hint(raw_session_id) when is_binary(raw_session_id) do
    case Integer.parse(raw_session_id) do
      {session_id, ""} when session_id > 0 -> session_id
      _ -> nil
    end
  end

  defp join_error_reason(:ended), do: "session_ended"
  defp join_error_reason(:not_found), do: "session_not_found"
  defp join_error_reason(:invalid_session_id), do: "invalid_session_id"
  defp join_error_reason(:session_ended), do: "session_ended"
  defp join_error_reason(:not_authorized), do: "not_authorized"
  defp join_error_reason(:rate_limited), do: "rate_limited"
  defp join_error_reason({:owned_by_remote, _owner_node}), do: "session_unavailable"

  defp join_error_reason(reason)
       when reason in [:remote_not_found, :remote_timeout, :remote_unreachable],
       do: "session_unavailable"

  defp join_error_reason(_reason), do: "join_failed"

  defp message_error_reason(:session_ended), do: "session_ended"
  defp message_error_reason(:not_authorized), do: "not_authorized"
  defp message_error_reason(:invalid_body), do: "invalid_body"
  defp message_error_reason(:rate_limited), do: "rate_limited"
  defp message_error_reason(%Ecto.Changeset{}), do: "invalid_message"

  defp safe_leave_live_session(live_session, current_user) do
    Live.leave_live_session(live_session, current_user)
  catch
    :exit, _reason ->
      :ok
  end

  @spec maybe_broadcast_session_state(map()) :: :ok
  defp maybe_broadcast_session_state(%{id: session_id})
       when is_integer(session_id) do
    case Live.get_live_session(session_id) do
      %{} = live_session ->
        broadcast_session_state(session_id, live_session)

      nil ->
        :ok
    end
  end

  defp maybe_broadcast_session_state(_live_session), do: :ok

  @doc false
  @spec published_session_state(pos_integer(), LCSchemas.Live.LiveSession.t()) :: %{
          session_state: Live.live_session_state()
        }
  def published_session_state(session_id, fallback_live_session)
      when is_integer(session_id) and is_map(fallback_live_session) do
    live_session =
      case Live.get_live_session(session_id) do
        %{} = persisted_live_session -> persisted_live_session
        nil -> fallback_live_session
      end

    %{session_state: Live.live_session_state_snapshot(live_session)}
  end

  @spec broadcast_session_state(pos_integer(), map()) :: :ok
  defp broadcast_session_state(session_id, live_session)
       when is_integer(session_id) and is_map(live_session) do
    topic = live_session_topic(session_id)

    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{
        topic: topic,
        event: "session:state",
        payload: published_session_state(session_id, live_session)
      }
    )
  end

  @spec live_session_topic(pos_integer()) :: String.t()
  defp live_session_topic(session_id) when is_integer(session_id),
    do: "live_session:#{session_id}"

  @type channel_event :: :chat_send | :join
  @type channel_result :: {:ok, term()} | {:error, term()}

  defp emit_channel_telemetry(event, metadata, result)
       when event in [:join, :chat_send] and is_map(metadata) do
    # Channel telemetry is non-blocking observability only and must never
    # change join/chat response semantics.
    :telemetry.execute(
      [:live_canvas, :live, :channel, event],
      %{count: 1},
      Map.merge(metadata, channel_result_metadata(result))
    )

    :ok
  end

  defp channel_result_metadata({:ok, _payload}), do: %{result: :ok}

  defp channel_result_metadata({:error, reason}) do
    %{result: :error, reason: channel_reason(reason)}
  end

  @spec channel_reason(term()) :: atom()
  defp channel_reason(%Ecto.Changeset{}), do: :changeset
  defp channel_reason({reason, _detail}) when is_atom(reason), do: reason
  defp channel_reason(reason) when is_atom(reason), do: reason
  defp channel_reason(_reason), do: :unknown

  @spec ensure_observability_context(Phoenix.Socket.t()) :: Phoenix.Socket.t()
  defp ensure_observability_context(%Phoenix.Socket{} = socket) do
    viewer_id = socket_viewer_id(socket)

    observability_context =
      case socket.assigns do
        %{observability_context: existing_context} ->
          existing_context

        _assigns ->
          ObservabilityContext.build_socket_context(%{}, viewer_id)
      end
      |> ObservabilityContext.put_viewer_context(viewer_id)

    Logger.metadata(ObservabilityContext.logger_metadata(observability_context))

    assign(socket, :observability_context, observability_context)
  end

  @spec put_live_session_observability_context(Phoenix.Socket.t(), pos_integer()) :: Phoenix.Socket.t()
  defp put_live_session_observability_context(%Phoenix.Socket{} = socket, session_id)
       when is_integer(session_id) do
    observability_context =
      socket.assigns
      |> Map.fetch!(:observability_context)
      |> ObservabilityContext.put_live_session_context(session_id)

    Logger.metadata(ObservabilityContext.logger_metadata(observability_context))

    assign(socket, :observability_context, observability_context)
  end

  @spec socket_viewer_id(Phoenix.Socket.t()) :: pos_integer() | nil
  defp socket_viewer_id(%Phoenix.Socket{assigns: %{current_user: %{id: user_id}}})
       when is_integer(user_id),
       do: user_id

  defp socket_viewer_id(_socket), do: nil

  @spec socket_identity_metadata(Phoenix.Socket.t()) :: %{
          session_id: pos_integer() | nil,
          user_id: pos_integer() | nil
        }
  defp socket_identity_metadata(%Phoenix.Socket{
         assigns: %{current_user: %{id: user_id}, live_session: %{id: live_session_id}}
       })
       when is_integer(user_id) and is_integer(live_session_id) do
    %{session_id: live_session_id, user_id: user_id}
  end

  defp socket_identity_metadata(%Phoenix.Socket{assigns: %{current_user: %{id: user_id}}})
       when is_integer(user_id) do
    %{session_id: nil, user_id: user_id}
  end

  defp socket_identity_metadata(_socket), do: %{session_id: nil, user_id: nil}

  @spec socket_telemetry_metadata(Phoenix.Socket.t()) :: %{
          session_id: pos_integer() | nil,
          user_id: pos_integer() | nil,
          request_id: String.t() | nil,
          trace_id: String.t() | nil
        }
  defp socket_telemetry_metadata(socket) do
    Map.merge(socket_identity_metadata(socket), socket_observability_metadata(socket))
  end

  @spec socket_observability_metadata(Phoenix.Socket.t()) :: %{
          request_id: String.t() | nil,
          trace_id: String.t() | nil
        }
  defp socket_observability_metadata(%Phoenix.Socket{
         assigns: %{observability_context: %{request_id: request_id, trace_id: trace_id}}
       })
       when is_binary(request_id) and is_binary(trace_id) do
    %{request_id: request_id, trace_id: trace_id}
  end

  defp socket_observability_metadata(_socket), do: %{request_id: nil, trace_id: nil}

  @spec rate_limit_join(pos_integer()) :: :ok | {:error, :rate_limited}
  defp rate_limit_join(user_id) when is_integer(user_id) do
    RateLimiter.allow(:channel_join, "user:#{user_id}")
  end

  @spec rate_limit_chat_send(pos_integer(), pos_integer()) :: :ok | {:error, :rate_limited}
  defp rate_limit_chat_send(user_id, live_session_id)
       when is_integer(user_id) and is_integer(live_session_id) do
    # Scope to a viewer within a specific live session so one chatty room does
    # not globally throttle the same user in other rooms.
    RateLimiter.allow(:chat_send, "session:#{live_session_id}:user:#{user_id}")
  end

  @spec subscribe_to_control_topics(pos_integer(), pos_integer()) :: :ok
  defp subscribe_to_control_topics(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id) do
    # Session control topics let GraphQL lifecycle mutations invalidate already
    # joined channels so socket state does not drift from persisted state.
    :ok = LCWeb.Endpoint.subscribe(session_control_topic(session_id))
    :ok = LCWeb.Endpoint.subscribe(session_user_control_topic(session_id, user_id))
    :ok
  end

  @spec session_control_topic(pos_integer()) :: String.t()
  defp session_control_topic(session_id) when is_integer(session_id),
    do: "live_session_control:#{session_id}"

  @spec session_user_control_topic(pos_integer(), pos_integer()) :: String.t()
  defp session_user_control_topic(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id),
       do: "live_session_control:#{session_id}:user:#{user_id}"
end
