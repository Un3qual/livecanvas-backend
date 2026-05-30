defmodule LC.Authz.PolicyTest do
  use ExUnit.Case, async: true

  alias LC.Accounts.Scope
  alias LC.Authz.Policy
  alias LCSchemas.Accounts.User

  describe "scope_authenticated policy" do
    test "allows an authenticated user scope" do
      scope = Scope.for_user(%User{id: 1})

      assert Policy.authorize(:scope_authenticated, scope, nil) == :ok
      assert Policy.authorize?(:scope_authenticated, scope, nil)
    end

    test "rejects anonymous callers" do
      assert Policy.authorize(:scope_authenticated, nil, nil) == {:error, :not_authorized}
      refute Policy.authorize?(:scope_authenticated, nil, nil)
    end
  end
end
