defmodule LCGQL.Accounts.ContactResolverTest do
  # Repo telemetry handlers are VM-global, so keep this query-count assertion
  # isolated until the stacked read-policy PR scopes captures to their caller.
  use LC.DataCase, async: false

  import LC.AccountsFixtures

  alias LC.Social
  alias LCGQL.Accounts.ContactResolver

  describe "visible_contact_match_node/2" do
    test "projects scalar fields with one explicit visibility query" do
      viewer = user_fixture()
      visible_match = user_fixture()
      hidden_match = user_fixture()
      birthday = ~D[1990-02-15]
      contact_entry = %{id: 42, contact_name: "Email Match", birthday: birthday}
      invite_recipient = "friend@example.com"

      assert {:ok, _block} = Social.block_user(hidden_match, viewer)

      {contact_match_node, queries} =
        capture_repo_queries(fn ->
          ContactResolver.visible_contact_match_node(
            %{
              contact_entry: contact_entry,
              invite_recipient: invite_recipient,
              matched_users: [visible_match, hidden_match]
            },
            viewer
          )
        end)

      assert %{
               id: 42,
               contact_name: "Email Match",
               birthday: ^birthday,
               invite_recipient: ^invite_recipient,
               contact_entry: ^contact_entry,
               matched_users: [^visible_match]
             } = contact_match_node

      assert count_table_queries(queries, "blocks") == 1
    end
  end
end
