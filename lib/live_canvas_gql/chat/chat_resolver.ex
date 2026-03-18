defmodule LCGQL.Chat.Resolver do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.{Accounts, Chat}
  alias LCGQL.Relay

  @type connection_result :: {:ok, Absinthe.Relay.Connection.t()} | {:error, term()}
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

  @spec chat_message_sender(map(), map(), Absinthe.Resolution.t()) :: {:ok, map() | nil}
  def chat_message_sender(%{sender: %{id: _id} = sender}, _args, _resolution), do: {:ok, sender}

  def chat_message_sender(%{sender_id: sender_id}, _args, _resolution)
      when is_integer(sender_id) do
    try do
      {:ok, Accounts.get_user!(sender_id)}
    rescue
      Ecto.NoResultsError -> {:ok, nil}
    end
  end

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

  defp maybe_broadcast_removal_system_event(
         %{live_session: live_session} = removed_message,
         true,
         viewer
       )
       when is_map(live_session) and is_map(viewer) do
    live_session
    |> Chat.record_system_event(:message_removed, actor: viewer, metadata: %{chat_message: removed_message})
    |> broadcast_system_event()
  end

  defp maybe_broadcast_removal_system_event(_removed_message, _transitioned?, _viewer), do: :ok

  defp broadcast_system_event({:ok, system_event}), do: Chat.broadcast_message(system_event)
  defp broadcast_system_event({:error, _reason}), do: :ok

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
