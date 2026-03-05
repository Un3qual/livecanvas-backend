defmodule LCGQL.Content.Types do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Content.Resolver

  enum :post_kind do
    value(:standard)
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

  enum :upload_http_method do
    value(:put)
    value(:post)
  end

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

  node object(:post) do
    field :kind, non_null(:post_kind)
    field :body_text, :string
    field :visibility, non_null(:post_visibility)
    field :expires_at, :string
    field :inserted_at, non_null(:string)

    field :author, non_null(:user) do
      resolve(&Resolver.author/3)
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

  object :content_error do
    field :field, :string
    field :message, non_null(:string)
  end
end
