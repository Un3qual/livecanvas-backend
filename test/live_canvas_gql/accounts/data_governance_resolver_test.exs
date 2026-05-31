defmodule LCGQL.Accounts.DataGovernanceResolverTest do
  use ExUnit.Case, async: true

  alias LCGQL.Accounts.DataGovernanceResolver

  describe "request_viewer_data_export/3" do
    test "returns an unauthenticated data-export payload without a viewer scope" do
      assert {:ok,
              %{
                data_export_request: nil,
                errors: [%{field: nil, message: "unauthenticated"}]
              }} = DataGovernanceResolver.request_viewer_data_export(nil, %{}, %{})
    end
  end
end
