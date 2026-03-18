defmodule LCGQL.Chat.Resolver do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.{Accounts, Chat}
  alias LCGQL.Relay

  @type connection_result :: {:ok, Absinthe.Relay.Connection.t()} | {:error, term()}
  @type chat_system_event_details :: %{
          optional(:chat_message_entropy_id) => Ecto.UUID.t(),
          optional(:chat_message_id) => String.t()
        }
  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type remove_message_payload :: %{chat_message: map() | nil, errors: [mutation_error()]}
  @type remove_message_result :: {:ok, remove_message_payload()}
  @type remove_message_reason ::
          :invalid_id | :invalid_type | :not_found | :not_authorized | :unauthenticated

  @spec chat_messages(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def chat_messages(%{id: _id} = live_session, args, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution),
         # History reads stay valid after a session ends, so GraphQL must
         # consult the dedicated history policy instead of join-only rules.
         :ok <- Chat.authorize_history_access(viewer, live_session) do
      query =
        live_session
        |> Chat.history_query()
        |> preload(:sender)

      # Relay cursors depend on the Chat boundary's inserted_at/id total order,
      # so keep GraphQL pagination on the same query shape.
      Absinthe.Relay.Connection.from_query(query, &Chat.run_query/1, args)
    else
      _other -> Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec remove_live_chat_message(
          term(),
          %{optional(:input) => map(), optional(:chat_message_id) => term()},
          Absinthe.Resolution.t()
        ) ::
          remove_message_result()
  def remove_live_chat_message(parent, %{input: input}, resolution),
    do: remove_live_chat_message(parent, input, resolution)

  def remove_live_chat_message(
        _parent,
        %{chat_message_id: chat_message_id},
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, decoded_id} <- Relay.decode_global_id(chat_message_id, :chat_message, LCGQL.Schema),
         %{} = chat_message <- Chat.get_history_message(viewer, decoded_id),
         {:ok, removed_message, transitioned?} <- Chat.remove_message_with_transition(chat_message, viewer) do
      # Durable redaction fixes future history reads, but joined viewers keep
      # rendering the original channel event until they reconcile an update.
      :ok = Chat.broadcast_message_update(removed_message)
      # Emit from the moderation adapter after the state transition succeeds so
      # `LC.Chat` stays responsible for persistence without owning its callers.
      :ok = maybe_broadcast_removal_system_event(removed_message, transitioned?, viewer)
      {:ok, %{chat_message: removed_message, errors: []}}
    else
      nil ->
        {:ok, %{chat_message: nil, errors: [mutation_error(:chat_message_id, :not_found)]}}

      {:error, reason} when reason in [:invalid_id, :invalid_type, :not_found, :not_authorized] ->
        {:ok, %{chat_message: nil, errors: [mutation_error(:chat_message_id, reason)]}}
    end
  end

  def remove_live_chat_message(_parent, _args, _resolution) do
    {:ok, %{chat_message: nil, errors: [mutation_error(nil, :unauthenticated)]}}
  end

  @spec chat_message_body(map(), map(), Absinthe.Resolution.t()) :: {:ok, String.t() | nil}
  def chat_message_body(chat_message, _args, _resolution) when is_map(chat_message) do
    # Moderated rows stay in Relay connections so clients can reconcile an
    # existing edge in place without shifting cursors; only the visible body is
    # redacted at the GraphQL boundary.
    {:ok, visible_body(chat_message)}
  end

  @spec chat_message_system_event_type(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, LCSchemas.Chat.chat_system_event_type() | nil}
  def chat_message_system_event_type(chat_message, _args, _resolution) when is_map(chat_message) do
    {:ok, system_event_type(chat_message)}
  end

  @spec chat_message_system_event_details(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, chat_system_event_details() | nil}
  def chat_message_system_event_details(chat_message, _args, _resolution) when is_map(chat_message) do
    {:ok, system_event_details(chat_message)}
  end

  @spec chat_message_moderated_at(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, String.t() | nil}
  def chat_message_moderated_at(%{moderated_at: %DateTime{} = moderated_at}, _args, _resolution) do
    {:ok, DateTime.to_iso8601(moderated_at)}
  end

  def chat_message_moderated_at(_chat_message, _args, _resolution), do: {:ok, nil}

  @spec chat_message_inserted_at(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, String.t()}
  def chat_message_inserted_at(%{inserted_at: %DateTime{} = inserted_at}, _args, _resolution) do
    {:ok, DateTime.to_iso8601(inserted_at)}
  end

  def chat_message_inserted_at(_chat_message, _args, _resolution), do: {:ok, ""}

  @spec chat_message_sender(map(), map(), Absinthe.Resolution.t()) ::
          LCGQL.Dataloader.dataloader_result()
  def chat_message_sender(%{sender: %{id: _id} = sender}, _args, _resolution), do: {:ok, sender}

  def chat_message_sender(%{sender_id: sender_id} = chat_message, _args, resolution)
      when is_integer(sender_id),
      do: LCGQL.Dataloader.load_assoc(chat_message, :sender, Accounts, resolution)

  def chat_message_sender(_chat_message, _args, _resolution), do: {:ok, nil}

  @spec viewer_from_resolution(Absinthe.Resolution.t()) :: {:ok, map()} | :error
  defp viewer_from_resolution(%Absinthe.Resolution{
         context: %{current_scope: %{user: %{id: user_id} = viewer}}
       })
       when is_integer(user_id) do
    {:ok, viewer}
  end

  defp viewer_from_resolution(_resolution), do: :error

  @spec visible_body(map()) :: String.t() | nil
  defp visible_body(%{status: :removed}), do: nil
  defp visible_body(%{status: "removed"}), do: nil
  defp visible_body(chat_message) when is_map(chat_message), do: Map.get(chat_message, :body)

  @spec system_event_type(map()) :: LCSchemas.Chat.chat_system_event_type() | nil
  defp system_event_type(%{kind: kind} = chat_message) when kind in [:system_event, "system_event"] do
    chat_message
    |> metadata()
    |> value_for(:event_type)
    |> cast_system_event_type()
  end

  defp system_event_type(_chat_message), do: nil

  @spec cast_system_event_type(term()) :: LCSchemas.Chat.chat_system_event_type() | nil
  defp cast_system_event_type(:message_removed), do: :message_removed
  defp cast_system_event_type(:session_ended), do: :session_ended
  defp cast_system_event_type(:session_live), do: :session_live
  defp cast_system_event_type("message_removed"), do: :message_removed
  defp cast_system_event_type("session_ended"), do: :session_ended
  defp cast_system_event_type("session_live"), do: :session_live
  defp cast_system_event_type(_event_type), do: nil

  @spec system_event_details(map()) :: chat_system_event_details() | nil
  defp system_event_details(chat_message) when is_map(chat_message) do
    if is_nil(system_event_type(chat_message)) do
      nil
    else
      details = chat_message |> metadata() |> value_for(:details)
      payload = %{}

      # Related message references stay Relay-friendly here so clients never
      # have to mix raw database ids into the shared GraphQL history surface.
      payload =
        case value_for(details, :chat_message_id) do
          chat_message_id when is_integer(chat_message_id) and chat_message_id > 0 ->
            Map.put(
              payload,
              :chat_message_id,
              Absinthe.Relay.Node.to_global_id(:chat_message, chat_message_id, LCGQL.Schema)
            )

          _other ->
            payload
        end

      payload =
        case value_for(details, :chat_message_entropy_id) do
          chat_message_entropy_id when is_binary(chat_message_entropy_id) ->
            Map.put(payload, :chat_message_entropy_id, chat_message_entropy_id)

          _other ->
            payload
        end

      if map_size(payload) == 0, do: nil, else: payload
    end
  end

  @spec metadata(map()) :: map()
  defp metadata(chat_message) when is_map(chat_message) do
    case value_for(chat_message, :metadata) do
      metadata when is_map(metadata) -> metadata
      _other -> %{}
    end
  end

  defp value_for(attrs, key) when is_map(attrs) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
  end

  defp value_for(_attrs, _key), do: nil

  defp maybe_broadcast_removal_system_event(
         %{live_session: live_session} = removed_message,
         true,
         viewer
       )
       when is_map(live_session) and is_map(viewer) do
    # Moderating durable system events should redact the row in place without
    # recursively persisting another moderation event about the prior event.
    if user_message_kind?(removed_message) do
      live_session
      |> Chat.record_system_event(:message_removed,
        actor: viewer,
        metadata: %{chat_message: removed_message}
      )
      |> broadcast_system_event()
    else
      :ok
    end
  end

  defp maybe_broadcast_removal_system_event(_removed_message, _transitioned?, _viewer), do: :ok

  defp broadcast_system_event({:ok, system_event}), do: Chat.broadcast_message(system_event)
  defp broadcast_system_event({:error, _reason}), do: :ok

  defp user_message_kind?(%{kind: kind}) when kind in [:user_message, "user_message"], do: true
  defp user_message_kind?(_chat_message), do: false

  @spec mutation_error(:chat_message_id | nil, remove_message_reason()) :: mutation_error()
  defp mutation_error(field, reason) do
    %{
      field: error_field(field, reason),
      message: error_message(reason)
    }
  end

  @spec error_field(:chat_message_id | nil, remove_message_reason()) :: String.t() | nil
  defp error_field(:chat_message_id, reason) when reason in [:invalid_id, :invalid_type],
    do: "chatMessageId"

  defp error_field(_field, _reason), do: nil

  @spec error_message(remove_message_reason()) :: String.t()
  defp error_message(reason) when reason in [:invalid_id, :invalid_type], do: "is invalid"
  defp error_message(reason), do: Atom.to_string(reason)
end
