defmodule LC.Chat.TimelineBroadcasts do
  @moduledoc false

  alias LC.Chat.TimelineProjection
  alias Phoenix.Socket.Broadcast

  @type event_payload :: %{
          __typename: String.t(),
          id: pos_integer(),
          event_type: String.t(),
          occurred_at: String.t(),
          actor_id: pos_integer() | nil,
          body: String.t() | nil,
          edited: boolean() | nil,
          edit_count: non_neg_integer() | nil,
          edited_at: String.t() | nil
        }
  @typep chat_message_payload_key :: :body | :edited | :edit_count
  @typep chat_message_payload_value :: String.t() | boolean() | non_neg_integer() | nil

  @spec broadcast_event(TimelineProjection.t(), String.t()) :: :ok
  def broadcast_event(%{live_session_id: live_session_id} = timeline_event, topic)
      when is_integer(live_session_id) and is_binary(topic) do
    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{
        topic: topic,
        event: "timeline:event",
        payload: %{event: event_payload(timeline_event)}
      }
    )
  end

  def broadcast_event(_timeline_event, _topic), do: :ok

  @spec broadcast_event_update(TimelineProjection.t(), String.t()) :: :ok
  def broadcast_event_update(%{live_session_id: live_session_id} = timeline_event, topic)
      when is_integer(live_session_id) and is_binary(topic) do
    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{
        topic: topic,
        event: "timeline:event_updated",
        payload: %{event: event_payload(timeline_event)}
      }
    )
  end

  def broadcast_event_update(_timeline_event, _topic), do: :ok

  @spec broadcast_event_removed(pos_integer(), String.t()) :: :ok
  def broadcast_event_removed(timeline_event_id, topic)
      when is_integer(timeline_event_id) and timeline_event_id > 0 and is_binary(topic) do
    Phoenix.PubSub.broadcast(
      LC.PubSub,
      topic,
      %Broadcast{
        topic: topic,
        event: "timeline:event_removed",
        payload: %{removed_timeline_event_id: timeline_event_id}
      }
    )
  end

  def broadcast_event_removed(_timeline_event_id, _topic), do: :ok

  @spec event_payload(TimelineProjection.t()) :: event_payload()
  def event_payload(timeline_event) when is_map(timeline_event) do
    event_type = Map.get(timeline_event, :event_type)

    %{
      __typename: timeline_event_typename(event_type),
      id: Map.get(timeline_event, :id),
      event_type: event_type_string(event_type),
      occurred_at: iso8601(Map.get(timeline_event, :occurred_at)),
      actor_id: Map.get(timeline_event, :actor_user_id),
      body: chat_message_value(timeline_event, event_type, :body),
      edited: chat_message_value(timeline_event, event_type, :edited),
      edit_count: chat_message_value(timeline_event, event_type, :edit_count),
      edited_at: chat_message_edited_at(timeline_event, event_type)
    }
  end

  @spec chat_message_value(
          TimelineProjection.t(),
          atom() | String.t() | nil,
          chat_message_payload_key()
        ) :: chat_message_payload_value()
  defp chat_message_value(timeline_event, event_type, key)
       when event_type in [:chat_message_sent, "chat_message_sent"] do
    Map.get(timeline_event, key)
  end

  defp chat_message_value(_timeline_event, _event_type, _key), do: nil

  @spec chat_message_edited_at(TimelineProjection.t(), atom() | String.t() | nil) ::
          String.t() | nil
  defp chat_message_edited_at(timeline_event, event_type)
       when event_type in [:chat_message_sent, "chat_message_sent"] do
    iso8601(Map.get(timeline_event, :edited_at))
  end

  defp chat_message_edited_at(_timeline_event, _event_type), do: nil

  @spec timeline_event_typename(atom() | String.t() | nil) :: String.t()
  defp timeline_event_typename(:chat_message_sent), do: "ChatMessageEvent"
  defp timeline_event_typename("chat_message_sent"), do: "ChatMessageEvent"
  defp timeline_event_typename(:live_session_started), do: "LiveSessionStartedEvent"
  defp timeline_event_typename("live_session_started"), do: "LiveSessionStartedEvent"
  defp timeline_event_typename(:live_session_ended), do: "LiveSessionEndedEvent"
  defp timeline_event_typename("live_session_ended"), do: "LiveSessionEndedEvent"
  defp timeline_event_typename(_event_type), do: "TimelineEvent"

  @spec event_type_string(atom() | String.t() | nil) :: String.t() | nil
  defp event_type_string(nil), do: nil
  defp event_type_string(event_type) when is_atom(event_type), do: Atom.to_string(event_type)
  defp event_type_string(event_type) when is_binary(event_type), do: event_type

  @spec iso8601(DateTime.t() | nil) :: String.t() | nil
  defp iso8601(%DateTime{} = datetime), do: DateTime.to_iso8601(datetime)
  defp iso8601(nil), do: nil
end
