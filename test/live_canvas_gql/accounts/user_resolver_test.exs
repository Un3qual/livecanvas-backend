defmodule LCGQL.Accounts.UserResolverTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Accounts
  alias LCGQL.Accounts.UserResolver

  describe "user_email/3" do
    test "returns email only for the owning viewer" do
      owner = user_fixture()
      outsider = user_fixture()

      owner_resolution = %Absinthe.Resolution{
        context: %{current_scope: Accounts.scope_for_user(owner)}
      }

      outsider_resolution = %Absinthe.Resolution{
        context: %{current_scope: Accounts.scope_for_user(outsider)}
      }

      assert {:ok, owner.email} == UserResolver.user_email(owner, %{}, owner_resolution)
      assert {:ok, nil} == UserResolver.user_email(owner, %{}, outsider_resolution)
      assert {:ok, nil} == UserResolver.user_email(owner, %{}, %Absinthe.Resolution{})
    end
  end
end
