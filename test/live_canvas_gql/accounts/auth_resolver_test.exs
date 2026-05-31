defmodule LCGQL.Accounts.AuthResolverTest do
  use ExUnit.Case, async: true

  alias LCGQL.Accounts.AuthResolver

  describe "issue_viewer_auth_tokens/3" do
    test "returns an unauthenticated token payload without a viewer scope" do
      assert {:ok,
              %{
                access_token: nil,
                refresh_token: nil,
                errors: [%{field: nil, message: "unauthenticated"}]
              }} = AuthResolver.issue_viewer_auth_tokens(nil, %{}, %{})
    end
  end
end
