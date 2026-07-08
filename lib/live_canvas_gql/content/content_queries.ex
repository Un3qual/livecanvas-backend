defmodule LCGQL.Content.Queries do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Content.Resolver

  object :content_queries do
    connection field :staff_post_reports, node_type: :post_report, paginate: :forward do
      arg(:status, :post_report_status)

      resolve(&Resolver.staff_post_reports/3)
    end

    field :post, :post do
      arg(:id, non_null(:id))

      resolve(&Resolver.post/3)
    end

    field :media_asset, :media_asset do
      arg(:id, non_null(:id))

      resolve(&Resolver.media_asset/3)
    end
  end
end
