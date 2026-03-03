defmodule LC.Accounts.NamespaceSmokeTest do
  use LC.DataCase, async: true

  test "LC accounts writes and reads through LCSchemas" do
    assert {:ok, user} = LC.Accounts.register_user_with_email(%{email: "lc@example.com"})
    assert %LCSchemas.Accounts.User{id: user_id} = LC.Accounts.get_user!(user.id)
    assert user_id == user.id
  end
end
