defmodule LCGQL.Chat.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Chat.Resolver

  connection(node_type: :chat_message)

  enum :chat_message_kind do
    value(:user_message)
    value(:system_event)
  end

  enum :chat_message_status do
    value(:active)
    value(:removed)
  end

  enum :chat_system_event_type do
    value(:message_removed)
    value(:session_ended)
    value(:session_live)
  end

  object :chat_system_event_details do
    field :chat_message_id, :id
    field :chat_message_entropy_id, :string
  end

  node object(:chat_message) do
    field :body, :string do
      resolve(&Resolver.chat_message_body/3)
    end

    field :kind, non_null(:chat_message_kind)
    field :status, non_null(:chat_message_status)

    field :system_event_type, :chat_system_event_type do
      resolve(&Resolver.chat_message_system_event_type/3)
    end

    field :system_event_details, :chat_system_event_details do
      resolve(&Resolver.chat_message_system_event_details/3)
    end

    field :moderated_at, :string do
      resolve(&Resolver.chat_message_moderated_at/3)
    end

    field :inserted_at, non_null(:string) do
      resolve(&Resolver.chat_message_inserted_at/3)
    end

    field :sender, :user do
      resolve(&Resolver.chat_message_sender/3)
    end
  end
end
