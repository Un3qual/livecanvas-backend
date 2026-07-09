defmodule LCGQL.Accounts.Queries do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Accounts.{ContactResolver, DataGovernanceResolver, UserResolver}

  object :account_queries do
    field :viewer, :user do
      resolve(&UserResolver.viewer/3)
    end

    connection field :viewer_data_export_requests,
                 node_type: :data_export_request,
                 paginate: :forward do
      resolve(&DataGovernanceResolver.viewer_data_export_requests/3)
    end

    connection field :viewer_account_deletion_requests,
                 node_type: :account_deletion_request,
                 paginate: :forward do
      resolve(&DataGovernanceResolver.viewer_account_deletion_requests/3)
    end

    connection field :viewer_contact_matches, node_type: :contact_match, paginate: :forward do
      resolve(&ContactResolver.viewer_contact_matches/3)
    end
  end
end
