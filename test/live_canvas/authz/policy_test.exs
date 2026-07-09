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

  describe "scope_post_report_moderation policy" do
    test "allows scopes with an active post-report moderation permission" do
      scope = Scope.for_user(%User{id: 1}, [:post_report_moderation])

      assert Policy.authorize(:scope_post_report_moderation, scope, nil) == :ok
      assert Policy.authorize?(:scope_post_report_moderation, scope, nil)
    end

    test "rejects authenticated scopes without the moderation permission" do
      scope = Scope.for_user(%User{id: 1})

      assert Policy.authorize(:scope_post_report_moderation, scope, nil) ==
               {:error, :not_authorized}

      refute Policy.authorize?(:scope_post_report_moderation, scope, nil)
    end

    test "rejects anonymous callers" do
      assert Policy.authorize(:scope_post_report_moderation, nil, nil) ==
               {:error, :not_authorized}

      refute Policy.authorize?(:scope_post_report_moderation, nil, nil)
    end
  end
end
