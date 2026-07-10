defmodule LCGQL.Accounts.ContactResolverTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Social
  alias LCGQL.Accounts.ContactResolver

  describe "contact_match_node/2" do
    test "projects scalar fields and omits users who blocked the viewer" do
      viewer = user_fixture()
      visible_match = user_fixture()
      hidden_match = user_fixture()
      birthday = ~D[1990-02-15]
      contact_entry = %{id: 42, contact_name: "Email Match", birthday: birthday}
      invite_recipient = "friend@example.com"

      assert {:ok, _block} = Social.block_user(hidden_match, viewer)

      assert %{
               id: 42,
               contact_name: "Email Match",
               birthday: ^birthday,
               invite_recipient: ^invite_recipient,
               contact_entry: ^contact_entry,
               matched_users: [^visible_match]
             } =
               ContactResolver.contact_match_node(
                 %{
                   contact_entry: contact_entry,
                   invite_recipient: invite_recipient,
                   matched_users: [visible_match, hidden_match]
                 },
                 viewer
               )
    end
  end
end
