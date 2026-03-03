defmodule LCWeb.LiveSessionChannel do
  use LCWeb, :channel

  alias LC.{Chat, Live}
  alias LCWeb.RateLimiter

  @impl true
  @spec join(String.t(), map(), Phoenix.Socket.t()) ::
          {:ok, map(), Phoenix.Socket.t()} | {:error, map()}
  def join(
        "live_session:" <> raw_session_id,
        _params,
        %Phoenix.Socket{assigns: %{current_user: %{id: user_id} = current_user}} = socket
      ) do
    session_id_hint = parse_session_id_hint(raw_session_id)

    result =
      with {:ok, session_id} <- parse_session_id(raw_session_id),
           true <- is_integer(user_id) || {:error, :not_authorized},
           :ok <- rate_limit_join(user_id),
           {:ok, live_session} <- Live.fetch_joinable_session(session_id),
           :ok <- Chat.authorize_join(current_user, live_session),
           {:ok, _participant} <- Live.join_live_session(live_session, current_user, :viewer) do
        {:ok, assign(socket, :live_session, live_session), session_id}
      else
        {:error, reason} -> {:error, reason}
      end

    case result do
      {:ok, joined_socket, session_id} ->
        :ok =
          emit_channel_telemetry(
            :join,
            %{session_id: session_id, user_id: user_id},
            {:ok, :joined}
          )

        {:ok, %{}, joined_socket}

      {:error, reason} ->
        :ok =
          emit_channel_telemetry(
            :join,
            %{session_id: session_id_hint, user_id: user_id},
            {:error, reason}
          )

        {:error, %{reason: join_error_reason(reason)}}
    end
  end

  def join("live_session:" <> raw_session_id, _params, _socket) do
    :ok =
      emit_channel_telemetry(
        :join,
        %{session_id: parse_session_id_hint(raw_session_id), user_id: nil},
        {:error, :not_authorized}
      )

    {:error, %{reason: join_error_reason(:not_authorized)}}
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
    result =
      with true <-
             (is_integer(user_id) && is_integer(live_session_id)) || {:error, :not_authorized},
           {:ok, chat_message} <-
             Chat.create_message(live_session, current_user, %{body: body}) do
        {:ok, %{message: chat_message_payload(chat_message)}}
      else
        {:error, reason} -> {:error, reason}
      end

    :ok =
      emit_channel_telemetry(
        :chat_send,
        %{session_id: live_session_id, user_id: user_id},
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
    :ok =
      emit_channel_telemetry(
        :chat_send,
        socket_identity_metadata(socket),
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
  defp message_error_reason(%Ecto.Changeset{}), do: "invalid_message"

  defp safe_leave_live_session(live_session, current_user) do
    Live.leave_live_session(live_session, current_user)
  catch
    :exit, _reason ->
      :ok
  end

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

  defp socket_identity_metadata(_socket), do: %{session_id: nil, user_id: nil}

  @spec rate_limit_join(pos_integer()) :: :ok | {:error, :rate_limited}
  defp rate_limit_join(user_id) when is_integer(user_id) do
    RateLimiter.allow(:channel_join, "user:#{user_id}")
  end

  defp chat_message_payload(chat_message) do
    %{
      id: chat_message.id,
      body: chat_message.body,
      sender_id: chat_message.sender_id,
      inserted_at: DateTime.to_iso8601(chat_message.inserted_at)
    }
  end
end
