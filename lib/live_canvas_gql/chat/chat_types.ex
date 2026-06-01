defmodule LCGQL.Chat.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Chat.Resolver

  connection(node_type: :live_session_timeline_event)

  enum :live_session_timeline_event_type do
    value(:chat_message_sent)
    value(:live_session_started)
    value(:live_session_ended)
  end

  interface :live_session_timeline_event do
    field :id, non_null(:id)
    field :event_type, non_null(:live_session_timeline_event_type)
    field :occurred_at, non_null(:string)
    field :actor, :user

    resolve_type(&Resolver.timeline_event_type/2)
  end

  node object(:chat_message_event) do
    interface(:live_session_timeline_event)

    field :event_type, non_null(:live_session_timeline_event_type)
    field :occurred_at, non_null(:string)
    field :actor, :user
    field :body, non_null(:string)
    field :edited, non_null(:boolean)
    field :edit_count, non_null(:integer)
    field :edited_at, :string
  end

  node object(:live_session_started_event) do
    interface(:live_session_timeline_event)

    field :event_type, non_null(:live_session_timeline_event_type)
    field :occurred_at, non_null(:string)
    field :actor, :user
  end

  node object(:live_session_ended_event) do
    interface(:live_session_timeline_event)

    field :event_type, non_null(:live_session_timeline_event_type)
    field :occurred_at, non_null(:string)
    field :actor, :user
  end
end
