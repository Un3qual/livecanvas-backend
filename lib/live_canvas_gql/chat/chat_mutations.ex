defmodule LCGQL.Chat.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Chat.Resolver

  object :chat_mutations do
    payload field :remove_live_chat_message do
      input do
        field :chat_message_id, non_null(:id)
      end

      output do
        field :chat_message, :chat_message
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.remove_live_chat_message/3)
    end
  end
end
