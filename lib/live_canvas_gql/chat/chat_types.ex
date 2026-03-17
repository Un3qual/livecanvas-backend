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

  node object(:chat_message) do
    field :body, :string do
      resolve(&Resolver.chat_message_body/3)
    end

    field :kind, non_null(:chat_message_kind)
    field :status, non_null(:chat_message_status)

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
