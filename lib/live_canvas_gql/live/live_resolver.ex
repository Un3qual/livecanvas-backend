defmodule LCGQL.Live.Resolver do
  alias LC.{Chat, Live}
  alias LCGQL.Relay
  alias LC.RateLimiter
  alias Phoenix.Socket.Broadcast

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type live_session_payload :: %{live_session: map() | nil, errors: [mutation_error()]}
  @type leave_live_session_payload :: %{left: boolean(), errors: [mutation_error()]}
  @type live_session_result :: {:ok, live_session_payload()}
  @type leave_live_session_result :: {:ok, leave_live_session_payload()}
  @type mutation_error_field :: :live_session_id | :recording_media_asset_id | nil
  @type mutation_reason ::
          :invalid_id
          | :invalid_type
          | :not_found
          | :unauthenticated
          | :not_authorized
          | :rate_limited
          | :ended
          | :invalid_state

  @spec start_live_session(
          term(),
          %{optional(:input) => map(), optional(:visibility) => atom()},
          Absinthe.Resolution.t()
        ) :: live_session_result()
  def start_live_session(parent, %{input: input}, resolution),
    do: start_live_session(parent, input, resolution)

  def start_live_session(
        _parent,
        args,
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, live_session} <- Live.start_live_session(viewer, start_live_session_attrs(args)) do
      {:ok, %{live_session: live_session, errors: []}}
    else
      {:error, :not_authorized} ->
        {:ok, %{live_session: nil, errors: [mutation_error(nil, :not_authorized)]}}

      _other ->
        {:ok, %{live_session: nil, errors: [mutation_error(nil, :invalid_state)]}}
    end
  end

  def start_live_session(_parent, _args, _resolution) do
    {:ok, %{live_session: nil, errors: [mutation_error(nil, :unauthenticated)]}}
  end

  @spec go_live_session(
          term(),
          %{optional(:input) => map(), optional(:live_session_id) => term()},
          Absinthe.Resolution.t()
        ) :: live_session_result()
  def go_live_session(parent, %{input: input}, resolution),
    do: go_live_session(parent, input, resolution)

  def go_live_session(
        _parent,
        %{live_session_id: live_session_id},
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, decoded_id} <- decode_live_session_id(live_session_id),
         {:ok, live_session} <- fetch_live_session(decoded_id),
         :ok <- ensure_host_owned(live_session, viewer),
         :ok <- ensure_joinable_state(live_session),
      {:ok, updated_live_session, transitioned?} <-
           Live.mark_session_live_with_transition(live_session) do
      # Emit from the adapter after the Live boundary succeeds so `LC.Live`
      # stays decoupled from durable chat history and channel transport details.
      :ok = maybe_emit_lifecycle_system_event(updated_live_session, :session_live, transitioned?, viewer)
      :ok = maybe_broadcast_lifecycle_state(updated_live_session, transitioned?)
      {:ok, %{live_session: updated_live_session, errors: []}}
    else
      {:error, reason}
      when reason in [:invalid_id, :invalid_type, :not_found, :not_authorized, :ended] ->
        {:ok, %{live_session: nil, errors: [mutation_error(:live_session_id, reason)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        if ended_go_live_changeset?(changeset) do
          {:ok, %{live_session: nil, errors: [mutation_error(nil, :ended)]}}
        else
          {:ok, %{live_session: nil, errors: [mutation_error(nil, :invalid_state)]}}
        end

      _other ->
        {:ok, %{live_session: nil, errors: [mutation_error(nil, :invalid_state)]}}
    end
  end

  def go_live_session(_parent, _args, _resolution) do
    {:ok, %{live_session: nil, errors: [mutation_error(nil, :unauthenticated)]}}
  end

  @spec join_live_session(
          term(),
          %{optional(:input) => map(), optional(:live_session_id) => term()},
          Absinthe.Resolution.t()
        ) :: live_session_result()
  def join_live_session(parent, %{input: input}, resolution),
    do: join_live_session(parent, input, resolution)

  def join_live_session(
        _parent,
        %{live_session_id: live_session_id},
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, decoded_id} <- decode_live_session_id(live_session_id),
         :ok <- rate_limit_join(viewer.id),
         {:ok, live_session} <- fetch_joinable_session(decoded_id),
         :ok <- authorize_join(viewer, live_session),
         {:ok, _participant} <- Live.join_live_session(live_session, viewer, :viewer) do
      {:ok, %{live_session: live_session, errors: []}}
    else
      {:error, :rate_limited} ->
        {:ok, %{live_session: nil, errors: [mutation_error(nil, :rate_limited)]}}

      {:error, reason}
      when reason in [:invalid_id, :invalid_type, :not_found, :not_authorized, :ended] ->
        {:ok, %{live_session: nil, errors: [mutation_error(:live_session_id, reason)]}}

      _other ->
        {:ok, %{live_session: nil, errors: [mutation_error(nil, :invalid_state)]}}
    end
  end

  def join_live_session(_parent, _args, _resolution) do
    {:ok, %{live_session: nil, errors: [mutation_error(nil, :unauthenticated)]}}
  end

  @spec leave_live_session(
          term(),
          %{optional(:input) => map(), optional(:live_session_id) => term()},
          Absinthe.Resolution.t()
        ) :: leave_live_session_result()
  def leave_live_session(parent, %{input: input}, resolution),
    do: leave_live_session(parent, input, resolution)

  def leave_live_session(
        _parent,
        %{live_session_id: live_session_id},
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, decoded_id} <- decode_live_session_id(live_session_id),
         {:ok, live_session} <- fetch_live_session(decoded_id) do
      :ok = Live.leave_live_session(live_session, viewer)
      :ok = disconnect_live_session_user(live_session.id, viewer.id, :viewer_left)
      {:ok, %{left: true, errors: []}}
    else
      {:error, reason} when reason in [:invalid_id, :invalid_type, :not_found] ->
        {:ok, %{left: false, errors: [mutation_error(:live_session_id, reason)]}}
    end
  end

  def leave_live_session(_parent, _args, _resolution) do
    {:ok, %{left: false, errors: [mutation_error(nil, :unauthenticated)]}}
  end

  @spec end_live_session(
          term(),
          %{
            optional(:input) => map(),
            optional(:live_session_id) => term(),
            optional(:recording_media_asset_id) => term()
          },
          Absinthe.Resolution.t()
        ) :: live_session_result()
  def end_live_session(parent, %{input: input}, resolution),
    do: end_live_session(parent, input, resolution)

  def end_live_session(
        _parent,
        %{live_session_id: live_session_id} = args,
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    case decode_optional_recording_media_asset_id(Map.get(args, :recording_media_asset_id)) do
      {:ok, recording_media_asset_id} ->
        end_attrs =
          case recording_media_asset_id do
            nil -> %{}
            decoded_id -> %{recording_media_asset_id: decoded_id}
          end

        with {:ok, decoded_id} <- decode_live_session_id(live_session_id),
             {:ok, live_session} <- fetch_live_session(decoded_id),
             :ok <- ensure_host_owned(live_session, viewer),
             :ok <- ensure_not_ended(live_session),
             {:ok, ended_live_session, transitioned?} <-
               # Keep ownership and processing-state validation in `LC.Live`; the
               # GraphQL layer only decodes Relay IDs before forwarding them.
               Live.end_live_session_with_transition(live_session, end_attrs) do
          # Broadcast the persisted terminal event before disconnecting joined
          # channels so they can reconcile one last durable history row in order.
          :ok =
            maybe_emit_lifecycle_system_event(
              ended_live_session,
              :session_ended,
              transitioned?,
              viewer
            )

          :ok = maybe_broadcast_lifecycle_state(ended_live_session, transitioned?)

          :ok =
            maybe_disconnect_live_session_channels(
              ended_live_session.id,
              transitioned?,
              :session_ended
            )

          {:ok, %{live_session: ended_live_session, errors: []}}
        else
          {:error, reason}
          when reason in [:invalid_id, :invalid_type, :not_found, :not_authorized, :ended] ->
            {:ok, %{live_session: nil, errors: [mutation_error(:live_session_id, reason)]}}

          {:error, %Ecto.Changeset{} = changeset} ->
            {:ok, %{live_session: nil, errors: format_changeset_errors(changeset)}}

          _other ->
            {:ok, %{live_session: nil, errors: [mutation_error(nil, :invalid_state)]}}
        end

      {:error, reason} ->
        {:ok, %{live_session: nil, errors: [mutation_error(:recording_media_asset_id, reason)]}}
    end
  end

  def end_live_session(_parent, _args, _resolution) do
    {:ok, %{live_session: nil, errors: [mutation_error(nil, :unauthenticated)]}}
  end

  defp decode_optional_recording_media_asset_id(nil), do: {:ok, nil}

  defp decode_optional_recording_media_asset_id(recording_media_asset_id) do
    Relay.decode_global_id(recording_media_asset_id, :media_asset, LCGQL.Schema)
  end

  defp decode_live_session_id(live_session_id),
    do: Relay.decode_global_id(live_session_id, :live_session, LCGQL.Schema)

  defp fetch_live_session(session_id) when is_integer(session_id) do
    case Live.get_live_session(session_id) do
      nil -> {:error, :not_found}
      live_session -> {:ok, live_session}
    end
  end

  defp fetch_joinable_session(session_id) when is_integer(session_id) do
    Live.fetch_joinable_session(session_id)
  end

  # Host-only lifecycle transitions prevent viewers from driving session
  # state changes through globally refetchable relay IDs.
  defp ensure_host_owned(%{host_id: host_id}, %{id: user_id})
       when is_integer(host_id) and is_integer(user_id) do
    if host_id == user_id, do: :ok, else: {:error, :not_authorized}
  end

  defp ensure_joinable_state(%{status: :ended}), do: {:error, :ended}
  defp ensure_joinable_state(_live_session), do: :ok

  defp ensure_not_ended(%{status: :ended}), do: {:error, :ended}
  defp ensure_not_ended(_live_session), do: :ok

  defp ended_go_live_changeset?(%Ecto.Changeset{data: %{status: :ended}, errors: errors}) do
    Enum.any?(errors, fn
      {:status, {_message, _opts}} -> true
      _other -> false
    end)
  end

  defp ended_go_live_changeset?(_changeset), do: false

  defp authorize_join(viewer, live_session) when is_map(viewer) and is_map(live_session) do
    # Keep GraphQL join policy aligned with channel joins so relationship and
    # moderation rules are enforced consistently across transports.
    case Chat.authorize_join(viewer, live_session) do
      :ok -> :ok
      {:error, :session_ended} -> {:error, :ended}
      {:error, :not_authorized} -> {:error, :not_authorized}
    end
  end

  @spec rate_limit_join(pos_integer()) :: :ok | {:error, :rate_limited}
  defp rate_limit_join(user_id) when is_integer(user_id) do
    RateLimiter.allow(:channel_join, "user:#{user_id}")
  end

  @spec disconnect_live_session_channels(pos_integer(), atom()) :: :ok
  defp disconnect_live_session_channels(session_id, reason) when is_integer(session_id) do
    topic = session_control_topic(session_id)

    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{topic: topic, event: "disconnect", payload: %{reason: Atom.to_string(reason)}}
    )
  end

  defp maybe_disconnect_live_session_channels(session_id, true, reason) when is_integer(session_id) do
    disconnect_live_session_channels(session_id, reason)
  end

  defp maybe_disconnect_live_session_channels(_session_id, _transitioned?, _reason), do: :ok

  @spec disconnect_live_session_user(pos_integer(), pos_integer(), atom()) :: :ok
  defp disconnect_live_session_user(session_id, user_id, reason)
       when is_integer(session_id) and is_integer(user_id) do
    topic = session_user_control_topic(session_id, user_id)

    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{topic: topic, event: "disconnect", payload: %{reason: Atom.to_string(reason)}}
    )
  end

  @spec start_live_session_attrs(map()) :: %{optional(:visibility) => atom()}
  defp start_live_session_attrs(args) when is_map(args) do
    Map.take(args, [:visibility])
  end

  @spec session_control_topic(pos_integer()) :: String.t()
  defp session_control_topic(session_id) when is_integer(session_id),
    do: "live_session_control:#{session_id}"

  @spec session_user_control_topic(pos_integer(), pos_integer()) :: String.t()
  defp session_user_control_topic(session_id, user_id)
       when is_integer(session_id) and is_integer(user_id),
       do: "live_session_control:#{session_id}:user:#{user_id}"

  defp maybe_emit_lifecycle_system_event(live_session, event_type, true, viewer)
       when event_type in [:session_ended, :session_live] and is_map(live_session) and
              is_map(viewer) do
    # Emit only when the persisted reload still matches the lifecycle event.
    # This suppresses stale `session_live` rows if a concurrent end wins before
    # the go-live caller reloads the row after owning the DB transition.
    if emit_matching_lifecycle_event?(live_session, event_type) do
      live_session
      |> Chat.record_system_event(event_type, actor: viewer)
      |> broadcast_system_event()
    else
      :ok
    end
  end

  defp maybe_emit_lifecycle_system_event(_live_session, _event_type, _transitioned?, _viewer), do: :ok

  defp emit_matching_lifecycle_event?(%{status: :live}, :session_live), do: true
  defp emit_matching_lifecycle_event?(%{status: :ended}, :session_ended), do: true
  defp emit_matching_lifecycle_event?(_live_session, _event_type), do: false

  defp broadcast_system_event({:ok, system_event}), do: Chat.broadcast_message(system_event)
  defp broadcast_system_event({:error, _reason}), do: :ok

  defp maybe_broadcast_lifecycle_state(live_session, true) when is_map(live_session) do
    broadcast_live_session_state(live_session)
  end

  defp maybe_broadcast_lifecycle_state(_live_session, _transitioned?), do: :ok

  @spec broadcast_live_session_state(map()) :: :ok
  defp broadcast_live_session_state(%{id: session_id} = live_session)
       when is_integer(session_id) and is_map(live_session) do
    topic = live_session_topic(session_id)

    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{
        topic: topic,
        event: "session:state",
        payload: %{session_state: Live.live_session_state_snapshot(live_session)}
      }
    )
  end

  @spec live_session_topic(pos_integer()) :: String.t()
  defp live_session_topic(session_id) when is_integer(session_id),
    do: "live_session:#{session_id}"

  @spec format_changeset_errors(Ecto.Changeset.t()) :: [mutation_error()]
  defp format_changeset_errors(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(fn {message, options} ->
      Enum.reduce(options, message, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.flat_map(fn {field, messages} ->
      Enum.map(messages, fn message ->
        %{field: camelize_lower(field), message: message}
      end)
    end)
  end

  @spec mutation_error(mutation_error_field(), mutation_reason()) :: mutation_error()
  defp mutation_error(field, reason) do
    %{
      field: error_field(field, reason),
      message: error_message(reason)
    }
  end

  @spec error_field(mutation_error_field(), mutation_reason()) :: String.t() | nil
  defp error_field(:live_session_id, reason) when reason in [:invalid_id, :invalid_type],
    do: "liveSessionId"

  defp error_field(:recording_media_asset_id, reason) when reason in [:invalid_id, :invalid_type],
    do: "recordingMediaAssetId"

  defp error_field(_field, _reason), do: nil

  @spec camelize_lower(atom()) :: String.t()
  defp camelize_lower(field) when is_atom(field) do
    field
    |> Atom.to_string()
    |> Macro.camelize()
    |> then(fn
      <<first::utf8, rest::binary>> -> String.downcase(<<first::utf8>>) <> rest
      "" -> ""
    end)
  end

  @spec error_message(mutation_reason()) :: String.t()
  defp error_message(reason) when reason in [:invalid_id, :invalid_type], do: "is invalid"
  defp error_message(reason), do: Atom.to_string(reason)
end
