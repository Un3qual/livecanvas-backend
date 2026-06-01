defmodule LCGQL.Chat.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Chat.Resolver

  object :chat_mutations do
    payload field :edit_live_chat_message do
      input do
        field :chat_message_event_id, non_null(:id)
        field :body, non_null(:string)
      end

      output do
        field :chat_message_event, :chat_message_event
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.edit_live_chat_message/3)
    end

    payload field :remove_live_chat_message_event do
      input do
        field :chat_message_event_id, non_null(:id)
      end

      output do
        field :removed_timeline_event_id, :id
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.remove_live_chat_message_event/3)
    end
  end
end
