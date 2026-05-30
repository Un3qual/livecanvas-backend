defmodule LCGQL.Content.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Content.Resolver

  object :content_mutations do
    payload field :create_post do
      input do
        field :kind, non_null(:create_post_kind)
        field :body_text, :string
        field :visibility, :post_visibility
        field :media_asset_ids, list_of(non_null(:id))
      end

      output do
        field :post, :post
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.create_post/3)
    end

    payload field :request_media_upload do
      input do
        field :mime_type, non_null(:string)
      end

      output do
        field :media_asset, :media_asset
        field :signed_upload, :signed_upload
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.request_media_upload/3)
    end

    payload field :update_post do
      input do
        field :post_id, non_null(:id)
        field :body_text, :string
        field :visibility, :post_visibility
      end

      output do
        field :post, :post
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.update_post/3)
    end

    payload field :delete_post do
      input do
        field :post_id, non_null(:id)
      end

      output do
        field :deleted_post_id, :id
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.delete_post/3)
    end

    payload field :report_post do
      input do
        field :post_id, non_null(:id)
        field :reason, non_null(:post_report_reason)
        field :details, :string
      end

      output do
        field :report, :post_report
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.report_post/3)
    end
  end
end
