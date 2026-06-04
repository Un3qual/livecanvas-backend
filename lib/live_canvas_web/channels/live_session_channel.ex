defmodule LCWeb.LiveSessionChannel do
  use LCWeb, :channel

  require Logger

  alias LC.Chat.TimelineProjection
  alias LC.{Chat, Live}
  alias LC.RateLimiter
  alias LCWeb.Plugs.ObservabilityContext
  alias LCTransport.{LiveSessionReasons, LiveSessionTopics}
  alias Phoenix.Socket.Broadcast

  @disconnect_event "disconnect"
  @media_events Live.prepare_live_media_session().events |> Map.values()

  intercept ["media:offer"]

  @impl true
  @spec join(String.t(), map(), Phoenix.Socket.t()) ::
          {:ok, map(), Phoenix.Socket.t()} | {:error, map()}
  def join(
        topic,
        _params,
        %Phoenix.Socket{assigns: %{current_user: %{id: user_id} = current_user}} = socket
      )
      when is_binary(topic) do
    socket = ensure_observability_context(socket)
    session_id_hint = LiveSessionTopics.session_id_hint(topic)

    result =
      with {:ok, session_id, topic_scope} <- LiveSessionTopics.parse_channel_topic(topic),
           true <- is_integer(user_id) || {:error, :not_authorized},
           :ok <- rate_limit_join(user_id),
           {:ok, live_session} <- Live.fetch_joinable_session(session_id),
           :ok <- Chat.authorize_join(current_user, live_session),
           :ok <- maybe_join_live_session(topic_scope, live_session, current_user),
           :ok <- subscribe_to_control_topics(session_id, user_id) do
        joined_socket =
          socket
          |> assign(:live_session, live_session)
          |> assign(:live_session_topic_scope, topic_scope)
          |> put_live_session_observability_context(session_id)

        :ok = maybe_broadcast_joined_session_state(topic_scope, session_id, live_session)

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

        {:error, %{reason: LiveSessionReasons.join_error_reason(reason)}}
    end
  end

  def join(topic, _params, socket) when is_binary(topic) do
    socket = ensure_observability_context(socket)

    :ok =
      emit_channel_telemetry(
        :join,
        Map.put(
          socket_telemetry_metadata(socket),
          :session_id,
          LiveSessionTopics.session_id_hint(topic)
        ),
        {:error, :not_authorized}
      )

    {:error, %{reason: LiveSessionReasons.join_error_reason(:not_authorized)}}
  end

  @impl true
  @spec handle_info(Broadcast.t(), Phoenix.Socket.t()) :: {:stop, term(), Phoenix.Socket.t()}
  def handle_info(%Broadcast{event: @disconnect_event, payload: payload}, socket)
      when is_map(payload) do
    push(socket, @disconnect_event, payload)
    {:stop, :session_disconnected, socket}
  end

  @impl true
  @spec handle_out(String.t(), map(), Phoenix.Socket.t()) :: {:noreply, Phoenix.Socket.t()}
  def handle_out(event, payload, socket) when is_binary(event) and is_map(payload) do
    payload = normalize_timeline_channel_payload(event, payload)
    socket = maybe_note_live_media_host_offer(event, socket)

    push(socket, event, payload)
    {:noreply, socket}
  end

  @impl true
  @spec handle_in(String.t(), term(), Phoenix.Socket.t()) ::
          {:reply, {:error | :ok, map()}, Phoenix.Socket.t()}
  def handle_in(
        event,
        payload,
        %Phoenix.Socket{
          assigns: %{
            current_user: %{id: user_id} = current_user,
            live_session: %{id: live_session_id} = live_session
          }
        } = socket
      )
      when event in @media_events and is_integer(user_id) and is_integer(live_session_id) do
    socket = ensure_observability_context(socket)

    result =
      with :ok <- require_media_signaling_topic(socket),
           :ok <- rate_limit_media_signal(user_id, live_session_id),
           :ok <- authorize_live_media_signal(event, current_user, live_session_id),
           {:ok, media_payload} <- validate_live_media_payload(event, payload),
           :ok <- maybe_mark_live_media_ready(event, current_user, live_session, socket) do
        {:ok, media_channel_payload(media_payload, current_user, live_session)}
      else
        {:error, reason} -> {:error, reason}
      end

    case result do
      {:ok, broadcast_payload} ->
        :ok = broadcast(socket, event, broadcast_payload)
        {:reply, {:ok, broadcast_payload}, socket}

      {:error, reason} ->
        {:reply, {:error, media_signaling_error_payload(reason)}, socket}
    end
  end

  def handle_in(event, _payload, socket) when event in @media_events do
    {:reply, {:error, media_signaling_error_payload(:not_authorized)}, socket}
  end

  def handle_in(
        "timeline:chat_message:send",
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
           {:ok, timeline_event} <-
             Chat.create_timeline_chat_message(live_session, current_user, %{body: body}) do
        {:ok, %{event: timeline_event_channel_payload(timeline_event)}, timeline_event}
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
      {:ok, payload, timeline_event} ->
        :ok = Chat.broadcast_timeline_event(timeline_event, socket.topic)
        {:reply, {:ok, payload}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: LiveSessionReasons.chat_send_error_reason(reason)}}, socket}
    end
  end

  def handle_in("timeline:chat_message:send", _payload, socket) do
    socket = ensure_observability_context(socket)

    :ok =
      emit_channel_telemetry(
        :chat_send,
        socket_telemetry_metadata(socket),
        {:error, :invalid_body}
      )

    {:reply, {:error, %{reason: LiveSessionReasons.chat_send_error_reason(:invalid_body)}},
     socket}
  end

  defp maybe_join_live_session(:live_session, live_session, current_user)
       when is_map(live_session) and is_map(current_user) do
    with {:ok, _participant} <- Live.join_live_session(live_session, current_user, :viewer) do
      :ok
    end
  end

  defp maybe_join_live_session(:media_signaling, _live_session, _current_user), do: :ok

  defp maybe_broadcast_joined_session_state(:live_session, session_id, live_session)
       when is_integer(session_id) and is_map(live_session) do
    broadcast_session_state(session_id, live_session)
  end

  defp maybe_broadcast_joined_session_state(:media_signaling, _session_id, _live_session),
    do: :ok

  defp require_media_signaling_topic(%Phoenix.Socket{
         assigns: %{live_session_topic_scope: :media_signaling}
       }),
       do: :ok

  defp require_media_signaling_topic(_socket), do: {:error, :not_authorized}

  defp authorize_live_media_signal(event, current_user, live_session_id)
       when is_binary(event) and is_map(current_user) and is_integer(live_session_id) do
    with {:ok, persisted_live_session} <- Live.fetch_joinable_session(live_session_id),
         :ok <- Chat.authorize_join(current_user, persisted_live_session),
         :ok <- authorize_live_media_event_role(event, current_user, persisted_live_session) do
      :ok
    else
      {:error, :ended} -> {:error, :session_ended}
      {:error, :not_found} -> {:error, :session_ended}
      {:error, :session_ended} -> {:error, :session_ended}
      {:error, :not_authorized} -> {:error, :not_authorized}
    end
  end

  defp authorize_live_media_event_role("media:offer", %{id: user_id}, %{host_id: host_id})
       when is_integer(user_id) and is_integer(host_id) do
    if user_id == host_id, do: :ok, else: {:error, :not_authorized}
  end

  defp authorize_live_media_event_role("media:answer", %{id: user_id}, %{
         id: live_session_id,
         host_id: host_id
       })
       when is_integer(user_id) and is_integer(live_session_id) and is_integer(host_id) do
    if user_id != host_id and Live.active_live_participant?(live_session_id, user_id) do
      :ok
    else
      {:error, :not_authorized}
    end
  end

  defp authorize_live_media_event_role("media:ice_candidate", %{id: user_id}, %{
         id: live_session_id,
         host_id: host_id
       })
       when is_integer(user_id) and is_integer(live_session_id) and is_integer(host_id) do
    cond do
      user_id == host_id ->
        :ok

      Live.active_live_participant?(live_session_id, user_id) ->
        :ok

      true ->
        {:error, :not_authorized}
    end
  end

  defp authorize_live_media_event_role(_event, _current_user, _live_session), do: :ok

  defp maybe_mark_live_media_ready(
         "media:answer",
         %{id: user_id},
         %{
           id: live_session_id,
           host_id: host_id
         },
         socket
       )
       when is_integer(user_id) and is_integer(live_session_id) and is_integer(host_id) and
              user_id != host_id do
    with :ok <- require_live_media_host_offer(socket) do
      case Live.mark_media_negotiation_ready(live_session_id) do
        :ok -> :ok
        {:error, :ended} -> {:error, :session_ended}
        {:error, :not_found} -> {:error, :session_ended}
        {:error, :not_authorized} -> {:error, :not_authorized}
        {:error, %Ecto.Changeset{}} -> {:error, :invalid_media_readiness}
      end
    end
  end

  defp maybe_mark_live_media_ready(_event, _current_user, _live_session, _socket), do: :ok

  defp require_live_media_host_offer(%Phoenix.Socket{
         assigns: %{live_media_host_offer_seen?: true}
       }),
       do: :ok

  defp require_live_media_host_offer(_socket), do: {:error, :not_authorized}

  defp maybe_note_live_media_host_offer(
         "media:offer",
         %Phoenix.Socket{assigns: %{live_session_topic_scope: :media_signaling}} = socket
       ) do
    # Viewer answers only trust an offer observed through this backend-authorized
    # signaling topic, not any client-supplied role flag.
    assign(socket, :live_media_host_offer_seen?, true)
  end

  defp maybe_note_live_media_host_offer(_event, socket), do: socket

  defp validate_live_media_payload(event, payload) when event in @media_events do
    case Live.validate_live_media_signal_payload(event, payload) do
      {:ok, media_payload} ->
        {:ok, media_payload}

      {:error, validation_errors} when is_list(validation_errors) ->
        {:error, {:invalid_media_payload, validation_errors}}
    end
  end

  defp media_channel_payload(media_payload, current_user, live_session)
       when is_map(media_payload) and is_map(current_user) and is_map(live_session) do
    media_payload
    |> Map.new(fn {key, value} -> {key, media_channel_payload_value(key, value)} end)
    |> Map.put(:sender_role, live_media_sender_role(current_user, live_session))
  end

  defp media_channel_payload_value(:type, value) when is_atom(value), do: Atom.to_string(value)
  defp media_channel_payload_value(_key, value), do: value

  defp live_media_sender_role(%{id: user_id}, %{host_id: host_id})
       when is_integer(user_id) and is_integer(host_id) and user_id == host_id,
       do: "host"

  defp live_media_sender_role(_current_user, _live_session), do: "viewer"

  defp media_signaling_error_payload({:invalid_media_payload, validation_errors})
       when is_list(validation_errors) do
    %{
      reason: "invalid_media_payload",
      errors: Enum.map(validation_errors, &media_validation_error_payload/1)
    }
  end

  defp media_signaling_error_payload(:session_ended), do: %{reason: "session_ended"}
  defp media_signaling_error_payload(:not_authorized), do: %{reason: "not_authorized"}
  defp media_signaling_error_payload(:rate_limited), do: %{reason: "rate_limited"}

  defp media_signaling_error_payload(:invalid_media_readiness),
    do: %{reason: "invalid_media_readiness"}

  defp media_validation_error_payload(%{field: field, reason: reason}) do
    reason = if is_atom(reason), do: Atom.to_string(reason), else: reason

    %{field: field, reason: reason}
  end

  # PubSub carries domain-shaped integer IDs inside the backend; the socket API
  # exposes Relay IDs so clients can reconcile channel events with GraphQL nodes.
  @spec normalize_timeline_channel_payload(String.t(), map()) :: map()
  defp normalize_timeline_channel_payload("timeline:event", %{event: event} = payload)
       when is_map(event) do
    %{payload | event: normalize_timeline_event_payload(event)}
  end

  defp normalize_timeline_channel_payload("timeline:event_updated", %{event: event} = payload)
       when is_map(event) do
    %{payload | event: normalize_timeline_event_payload(event)}
  end

  defp normalize_timeline_channel_payload(
         "timeline:event_removed",
         %{removed_timeline_event_id: timeline_event_id} = payload
       )
       when is_integer(timeline_event_id) do
    %{
      payload
      | removed_timeline_event_id:
          Absinthe.Relay.Node.to_global_id(:chat_message_event, timeline_event_id, LCGQL.Schema)
    }
  end

  defp normalize_timeline_channel_payload(_event, payload), do: payload

  @spec timeline_event_channel_payload(TimelineProjection.t()) :: map()
  defp timeline_event_channel_payload(timeline_event) when is_map(timeline_event) do
    timeline_event
    |> Chat.timeline_event_payload()
    |> normalize_timeline_event_payload()
  end

  @spec normalize_timeline_event_payload(map()) :: map()
  defp normalize_timeline_event_payload(event) when is_map(event) do
    event
    |> normalize_timeline_event_id()
    |> normalize_timeline_event_actor()
  end

  @spec normalize_timeline_event_id(map()) :: map()
  defp normalize_timeline_event_id(%{id: timeline_event_id, event_type: event_type} = event)
       when is_integer(timeline_event_id) do
    case timeline_event_node_type(event_type) do
      nil ->
        event

      node_type ->
        Map.put(
          event,
          :id,
          Absinthe.Relay.Node.to_global_id(node_type, timeline_event_id, LCGQL.Schema)
        )
    end
  end

  defp normalize_timeline_event_id(event), do: event

  @spec normalize_timeline_event_actor(map()) :: map()
  defp normalize_timeline_event_actor(%{actor_id: actor_id} = event)
       when is_integer(actor_id) do
    event
    |> Map.delete(:actor_id)
    |> Map.put(:actor, %{
      id: Absinthe.Relay.Node.to_global_id(:user, actor_id, LCGQL.Schema)
    })
  end

  defp normalize_timeline_event_actor(%{actor_id: nil} = event) do
    event
    |> Map.delete(:actor_id)
    |> Map.put(:actor, nil)
  end

  defp normalize_timeline_event_actor(event), do: event

  @spec timeline_event_node_type(atom() | String.t() | nil) :: atom() | nil
  defp timeline_event_node_type(:chat_message_sent), do: :chat_message_event
  defp timeline_event_node_type("chat_message_sent"), do: :chat_message_event
  defp timeline_event_node_type(:live_session_started), do: :live_session_started_event
  defp timeline_event_node_type("live_session_started"), do: :live_session_started_event
  defp timeline_event_node_type(:live_session_ended), do: :live_session_ended_event
  defp timeline_event_node_type("live_session_ended"), do: :live_session_ended_event
  defp timeline_event_node_type(_event_type), do: nil

  @impl true
  @spec terminate(term(), Phoenix.Socket.t()) :: :ok
  def terminate(
        _reason,
        %Phoenix.Socket{
          assigns: %{
            current_user: current_user,
            live_session: live_session,
            live_session_topic_scope: :live_session
          }
        }
      )
      when is_map(current_user) and is_map(live_session) do
    # Disconnect cleanup is best-effort because channel termination can race
    # against session shutdown; `LC.Live` handles idempotent reconciliation.
    safe_leave_live_session(live_session, current_user)
    :ok = maybe_broadcast_session_state(live_session)
    :ok
  end

  def terminate(_reason, _socket), do: :ok

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
    topic = LiveSessionTopics.live_session_topic(session_id)

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

  @type channel_event :: :chat_send | :join
  @type channel_result :: {:ok, term()} | {:ok, term(), term()} | {:error, term()}

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
  defp channel_result_metadata({:ok, _payload, _event}), do: %{result: :ok}

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

  @spec put_live_session_observability_context(Phoenix.Socket.t(), pos_integer()) ::
          Phoenix.Socket.t()
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

  @spec rate_limit_media_signal(pos_integer(), pos_integer()) :: :ok | {:error, :rate_limited}
  defp rate_limit_media_signal(user_id, live_session_id)
       when is_integer(user_id) and is_integer(live_session_id) do
    # ICE can burst during negotiation, but it still needs a per-session/user
    # guard before any database reads or PubSub fan-out.
    RateLimiter.allow(:media_signal, "session:#{live_session_id}:user:#{user_id}")
  end

  @spec subscribe_to_control_topics(pos_integer(), pos_integer()) :: :ok
  defp subscribe_to_control_topics(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id) do
    # Session control topics let GraphQL lifecycle mutations invalidate already
    # joined channels so socket state does not drift from persisted state.
    :ok = LCWeb.Endpoint.subscribe(LiveSessionTopics.session_control_topic(session_id))

    :ok =
      LCWeb.Endpoint.subscribe(LiveSessionTopics.session_user_control_topic(session_id, user_id))

    :ok
  end
end
