defmodule LCGQL.Feed.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Chat.Resolver, as: ChatResolver
  alias LCGQL.Feed.Resolver

  connection(node_type: :live_session)
  connection(node_type: :post)

  enum :live_session_status do
    value(:starting)
    value(:live)
    value(:ended)
  end

  enum :live_session_visibility do
    value(:followers)
    value(:public)
  end

  node object(:live_session) do
    field :status, non_null(:live_session_status)
    field :visibility, non_null(:live_session_visibility)
    field :started_at, :string
    field :ended_at, :string
    field :inserted_at, non_null(:string)

    field :host, non_null(:user) do
      resolve(&Resolver.host/3)
    end

    connection field :chat_messages, node_type: :chat_message, paginate: :both do
      resolve(&ChatResolver.chat_messages/3)
    end
  end
end
