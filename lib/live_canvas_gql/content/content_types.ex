defmodule LCGQL.Content.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  import Absinthe.Resolution.Helpers, only: [dataloader: 1]

  alias LC.Accounts
  alias LCGQL.Content.Resolver

  enum :post_kind do
    value(:standard)
    value(:story)
  end

  enum :create_post_kind do
    value(:standard)
    value(:story)
  end

  enum :post_visibility do
    value(:followers)
    value(:public)
  end

  enum :media_processing_state do
    value(:pending_upload)
    value(:uploaded)
    value(:processed)
    value(:failed)
  end

  enum :post_report_reason do
    value(:spam)
    value(:harassment)
    value(:hate)
    value(:violence)
    value(:sexual_content)
    value(:self_harm)
    value(:illegal)
    value(:other)
  end

  enum :post_report_status do
    value(:open)
    value(:reviewed)
    value(:dismissed)
    value(:actioned)
  end

  enum :upload_http_method do
    value(:put)
    value(:post)
  end

  connection(node_type: :post_report)

  object :signed_upload_header do
    field :name, non_null(:string)
    field :value, non_null(:string)
  end

  object :signed_upload do
    field :method, non_null(:upload_http_method)
    field :url, non_null(:string)
    field :expires_at, non_null(:string)
    field :headers, non_null(list_of(non_null(:signed_upload_header)))
  end

  object :post_media_asset do
    field :id, non_null(:id) do
      resolve(&Resolver.media_asset_id/3)
    end

    field :mime_type, non_null(:string)
    field :processing_state, non_null(:media_processing_state)

    field :public_url, :string do
      resolve(&Resolver.media_asset_public_url/3)
    end

    field :inserted_at, non_null(:string)
  end

  node object(:post) do
    field :kind, non_null(:post_kind)
    field :body_text, :string
    field :visibility, non_null(:post_visibility)
    field :expires_at, :string
    field :inserted_at, non_null(:string)

    field :author, non_null(:user) do
      resolve(dataloader(Accounts))
    end

    field :media_assets, non_null(list_of(non_null(:post_media_asset))) do
      resolve(&Resolver.media_assets/3)
    end
  end

  node object(:media_asset) do
    field :owner_id, non_null(:id)
    field :storage_key, non_null(:string)
    field :mime_type, non_null(:string)
    field :processing_state, non_null(:media_processing_state)

    field :public_url, :string do
      resolve(&Resolver.media_asset_public_url/3)
    end

    field :inserted_at, non_null(:string)
  end

  node object(:post_report) do
    field :post, :post do
      resolve(&Resolver.post_report_post/3)
    end

    field :post_id, non_null(:id) do
      resolve(&Resolver.post_report_post_id/3)
    end

    field :reporter_id, non_null(:id) do
      resolve(&Resolver.post_report_reporter_id/3)
    end

    field :reason, non_null(:post_report_reason)
    field :details, :string
    field :status, non_null(:post_report_status)
    field :decision_note, :string do
      resolve(&Resolver.post_report_decision_note/3)
    end

    field :reviewed_at, :string do
      resolve(&Resolver.post_report_reviewed_at/3)
    end

    field :reviewed_by_id, :id do
      resolve(&Resolver.post_report_reviewed_by_id/3)
    end

    field :inserted_at, non_null(:string)
  end
end
