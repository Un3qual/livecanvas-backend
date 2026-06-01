defmodule LCGQL.Feed.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  import Absinthe.Resolution.Helpers, only: [dataloader: 1]

  alias LC.Accounts
  alias LCGQL.Chat.Resolver, as: ChatResolver
  alias LCGQL.Content.Resolver, as: ContentResolver
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

  object :live_session_recording_media_asset do
    field :id, non_null(:id) do
      resolve(&Resolver.recording_media_asset_id/3)
    end

    field :processing_state, non_null(:media_processing_state)

    field :public_url, :string do
      resolve(&ContentResolver.media_asset_public_url/3)
    end
  end

  node object(:live_session) do
    field :status, non_null(:live_session_status)
    field :visibility, non_null(:live_session_visibility)
    field :started_at, :string
    field :ended_at, :string
    field :inserted_at, non_null(:string)

    field :host, non_null(:user) do
      resolve(dataloader(Accounts))
    end

    field :recording_media_asset, :live_session_recording_media_asset do
      resolve(&Resolver.recording_media_asset/3)
    end

    connection field :timeline_events, node_type: :live_session_timeline_event, paginate: :both do
      resolve(&ChatResolver.timeline_events/3)
    end
  end
end
