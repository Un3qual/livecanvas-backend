defmodule LCGQL.Accounts.ContactResolverTest do
  use ExUnit.Case, async: true

  alias LCGQL.Accounts.ContactResolver

  describe "contact_match_node/1" do
    test "projects contact match scalar fields from the contact entry" do
      birthday = ~D[1990-02-15]
      contact_entry = %{id: 42, contact_name: "Email Match", birthday: birthday}
      matched_users = [%{id: 7}]

      assert %{
               id: 42,
               contact_name: "Email Match",
               birthday: ^birthday,
               contact_entry: ^contact_entry,
               matched_users: ^matched_users
             } =
               ContactResolver.contact_match_node(%{
                 contact_entry: contact_entry,
                 matched_users: matched_users
               })
    end
  end
end
