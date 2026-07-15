defmodule LCGQL.Accounts.UserResolverTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.{Accounts, ReadPolicy, Social}
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

  describe "public profile identity fields" do
    test "returns public values anonymously and hides them from a viewer blocked by the owner" do
      owner = user_fixture()
      viewer = user_fixture()

      assert {:ok, owner} =
               Accounts.update_user_profile_identity(owner, %{
                 username: "canvas_creator",
                 display_name: "Canvas Creator"
               })

      anonymous_resolution = %Absinthe.Resolution{}

      viewer_resolution = %Absinthe.Resolution{
        context: %{current_scope: Accounts.scope_for_user(viewer)}
      }

      assert {:ok, "canvas_creator"} ==
               UserResolver.user_username(owner, %{}, anonymous_resolution)

      assert {:ok, "Canvas Creator"} ==
               UserResolver.user_display_name(owner, %{}, anonymous_resolution)

      assert {:ok, _block} = Social.block_user(owner, viewer)

      assert {:middleware, Absinthe.Middleware.Batch,
              {{ReadPolicy, :blocking_owner_ids, ^viewer}, owner_id, username_visibility, []}} =
               UserResolver.user_username(owner, %{}, viewer_resolution)

      assert owner_id == owner.id
      assert {:ok, nil} == username_visibility.([owner.id])
      assert {:ok, "canvas_creator"} == username_visibility.([])

      assert {:middleware, Absinthe.Middleware.Batch,
              {{ReadPolicy, :blocking_owner_ids, ^viewer}, ^owner_id, display_name_visibility, []}} =
               UserResolver.user_display_name(owner, %{}, viewer_resolution)

      assert {:ok, nil} == display_name_visibility.([owner.id])
      assert {:ok, "Canvas Creator"} == display_name_visibility.([])
    end

    test "hides suspended profile identity values at the child-field boundary" do
      owner = user_fixture()

      assert {:ok, owner} =
               Accounts.update_user_profile_identity(owner, %{
                 username: "suspended_creator",
                 display_name: "Suspended Creator"
               })

      assert {:ok, owner} = Accounts.suspend_user(owner)

      assert {:ok, nil} ==
               UserResolver.user_username(owner, %{}, %Absinthe.Resolution{})

      assert {:ok, nil} ==
               UserResolver.user_display_name(owner, %{}, %Absinthe.Resolution{})
    end
  end
end
