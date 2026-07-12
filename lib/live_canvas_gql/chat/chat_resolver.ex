defmodule LCGQL.Chat.Resolver do
  @moduledoc false

  alias LC.Chat
  alias LC.Chat.TimelineProjection
  alias LCGQL.MutationErrors
  alias LCGQL.Relay
  alias LCGQL.Resolution
  alias LCTransport.LiveSessionTopics

  @type connection_result :: {:ok, Absinthe.Relay.Connection.t()} | {:error, term()}
  @type mutation_error :: MutationErrors.user_error()
  @type edit_message_payload :: %{chat_message_event: map() | nil, errors: [mutation_error()]}
  @type edit_message_result :: {:ok, edit_message_payload()}
  @type remove_message_payload :: %{
          removed_timeline_event_id: String.t() | nil,
          errors: [mutation_error()]
        }
  @type remove_message_result :: {:ok, remove_message_payload()}
  @type timeline_event_reason ::
          :hidden
          | :invalid_id
          | :invalid_type
          | :not_authorized
          | :not_chat_message
          | :not_found
          | :session_ended
          | :unauthenticated

  @spec timeline_events(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def timeline_events(%{id: _id} = live_session, args, resolution) do
    with {:ok, viewer} <- Resolution.viewer(resolution),
         # History reads stay valid after a session ends, so GraphQL must
         # consult the dedicated history policy instead of join-only rules.
         :ok <- Chat.authorize_history_access(viewer, live_session) do
      viewer
      |> Chat.timeline_history_query(live_session)
      |> Absinthe.Relay.Connection.from_query(&Chat.run_query/1, args)
    else
      _other -> Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec timeline_event_type(map(), Absinthe.Resolution.t()) ::
          :chat_message_event | :live_session_started_event | :live_session_ended_event | nil
  def timeline_event_type(%{event_type: :chat_message_sent}, _resolution),
    do: :chat_message_event

  def timeline_event_type(%{event_type: "chat_message_sent"}, _resolution),
    do: :chat_message_event

  def timeline_event_type(%{event_type: :live_session_started}, _resolution),
    do: :live_session_started_event

  def timeline_event_type(%{event_type: "live_session_started"}, _resolution),
    do: :live_session_started_event

  def timeline_event_type(%{event_type: :live_session_ended}, _resolution),
    do: :live_session_ended_event

  def timeline_event_type(%{event_type: "live_session_ended"}, _resolution),
    do: :live_session_ended_event

  def timeline_event_type(_timeline_event, _resolution), do: nil

  @spec edit_live_chat_message(
          term(),
          %{
            optional(:input) => map(),
            optional(:chat_message_event_id) => term(),
            optional(:body) => term()
          },
          Absinthe.Resolution.t()
        ) :: edit_message_result()
  def edit_live_chat_message(parent, %{input: input}, resolution),
    do: edit_live_chat_message(parent, input, resolution)

  def edit_live_chat_message(
        _parent,
        %{chat_message_event_id: chat_message_event_id, body: body},
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, event_id} <- decode_chat_message_event_id(chat_message_event_id),
         %{event_type: event_type} = timeline_event when event_type in [:chat_message_sent] <-
           Chat.get_timeline_event(viewer, event_id),
         {:ok, edited_event} <-
           Chat.edit_timeline_chat_message(timeline_event, viewer, %{body: body}) do
      :ok = broadcast_timeline_event_update(edited_event)

      {:ok, %{chat_message_event: edited_event, errors: []}}
    else
      nil ->
        {:ok, %{chat_message_event: nil, errors: [timeline_event_error(nil, :not_found)]}}

      %{event_type: _other_event_type} ->
        {:ok,
         %{
           chat_message_event: nil,
           errors: [timeline_event_error(:chat_message_event_id, :not_chat_message)]
         }}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           chat_message_event: nil,
           errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)
         }}

      {:error, reason}
      when reason in [
             :hidden,
             :invalid_id,
             :invalid_type,
             :not_authorized,
             :not_found,
             :session_ended
           ] ->
        {:ok,
         %{
           chat_message_event: nil,
           errors: [timeline_event_error(:chat_message_event_id, reason)]
         }}
    end
  end

  def edit_live_chat_message(_parent, _args, _resolution) do
    {:ok, %{chat_message_event: nil, errors: [timeline_event_error(nil, :unauthenticated)]}}
  end

  @spec remove_live_chat_message_event(
          term(),
          %{optional(:input) => map(), optional(:chat_message_event_id) => term()},
          Absinthe.Resolution.t()
        ) :: remove_message_result()
  def remove_live_chat_message_event(parent, %{input: input}, resolution),
    do: remove_live_chat_message_event(parent, input, resolution)

  def remove_live_chat_message_event(
        _parent,
        %{chat_message_event_id: chat_message_event_id},
        %{context: %{current_scope: %{user: %{id: _id} = viewer}}}
      ) do
    with {:ok, event_id} <- decode_chat_message_event_id(chat_message_event_id),
         %{} = timeline_event <- Chat.get_timeline_event_for_moderation(viewer, event_id),
         {:ok, %{removed_event_id: removed_event_id, transitioned?: transitioned?}} <-
           Chat.remove_timeline_chat_message(timeline_event, viewer, %{}) do
      :ok =
        maybe_broadcast_timeline_event_removed(
          timeline_event,
          removed_event_id,
          transitioned?
        )

      {:ok,
       %{
         removed_timeline_event_id: timeline_event_global_id(removed_event_id),
         errors: []
       }}
    else
      nil ->
        {:ok,
         %{
           removed_timeline_event_id: nil,
           errors: [timeline_event_error(nil, :not_found)]
         }}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           removed_timeline_event_id: nil,
           errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)
         }}

      {:error, reason}
      when reason in [
             :invalid_id,
             :invalid_type,
             :not_authorized,
             :not_chat_message,
             :not_found,
             :session_ended
           ] ->
        {:ok,
         %{
           removed_timeline_event_id: nil,
           errors: [timeline_event_error(:chat_message_event_id, reason)]
         }}
    end
  end

  def remove_live_chat_message_event(_parent, _args, _resolution) do
    {:ok,
     %{removed_timeline_event_id: nil, errors: [timeline_event_error(nil, :unauthenticated)]}}
  end

  defp decode_chat_message_event_id(chat_message_event_id) do
    Relay.decode_global_id(chat_message_event_id, :chat_message_event, LCGQL.Schema)
  end

  @spec broadcast_timeline_event_update(TimelineProjection.t()) :: :ok
  defp broadcast_timeline_event_update(%{live_session_id: live_session_id} = timeline_event)
       when is_integer(live_session_id) do
    Chat.broadcast_timeline_event_update(
      timeline_event,
      LiveSessionTopics.live_session_topic(live_session_id)
    )
  end

  @spec maybe_broadcast_timeline_event_removed(TimelineProjection.t(), pos_integer(), boolean()) ::
          :ok
  defp maybe_broadcast_timeline_event_removed(
         %{live_session_id: live_session_id},
         removed_event_id,
         true
       )
       when is_integer(live_session_id) and is_integer(removed_event_id) do
    Chat.broadcast_timeline_event_removed(
      removed_event_id,
      LiveSessionTopics.live_session_topic(live_session_id)
    )
  end

  defp maybe_broadcast_timeline_event_removed(_timeline_event, _removed_event_id, _transitioned?),
    do: :ok

  @spec timeline_event_global_id(pos_integer()) :: String.t()
  defp timeline_event_global_id(event_id) when is_integer(event_id) and event_id > 0 do
    Absinthe.Relay.Node.to_global_id(:chat_message_event, event_id, LCGQL.Schema)
  end

  @spec timeline_event_error(:chat_message_event_id | nil, timeline_event_reason()) ::
          mutation_error()
  defp timeline_event_error(:chat_message_event_id, reason)
       when reason in [:invalid_id, :invalid_type, :not_chat_message],
       do: MutationErrors.invalid_error("chatMessageEventId")

  defp timeline_event_error(_field, reason), do: MutationErrors.user_error(nil, reason)
end
