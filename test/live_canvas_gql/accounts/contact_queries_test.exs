defmodule LCGQL.Accounts.ContactQueriesTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts

  describe "viewerContactMatches" do
    test "returns viewer-owned matches as a relay connection with matched user nodes" do
      viewer = user_fixture()
      matched_email_user = user_fixture()
      matched_phone_user = user_fixture()
      outsider = user_fixture()
      outsider_match = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      attach_phone_number(matched_phone_user, "(650) 253-2222",
        verified_at: DateTime.utc_now() |> DateTime.truncate(:microsecond)
      )

      {:ok, first_contact_entry} =
        Accounts.upsert_user_contact_entry(viewer, %{
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Email Match",
          birthday: "1990-02-15",
          emails: [matched_email_user.email],
          phone_numbers: []
        })

      {:ok, second_contact_entry} =
        Accounts.upsert_user_contact_entry(viewer, %{
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Phone Match",
          emails: [],
          phone_numbers: ["+1 650 253 2222"]
        })

      {:ok, _outsider_contact_entry} =
        Accounts.upsert_user_contact_entry(outsider, %{
          contact_client_id: :crypto.strong_rand_bytes(16),
          contact_name: "Outsider Match",
          emails: [outsider_match.email],
          phone_numbers: []
        })

      query = """
      query($first: Int!, $after: String) {
        viewerContactMatches(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              contactName
              birthday
              inviteRecipient
              matchedUsers {
                id
                email
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      """

      first_contact_id =
        Absinthe.Relay.Node.to_global_id(:contact_match, first_contact_entry.id, LCGQL.Schema)

      second_contact_id =
        Absinthe.Relay.Node.to_global_id(:contact_match, second_contact_entry.id, LCGQL.Schema)

      matched_email_user_id =
        Absinthe.Relay.Node.to_global_id(:user, matched_email_user.id, LCGQL.Schema)

      matched_phone_user_id =
        Absinthe.Relay.Node.to_global_id(:user, matched_phone_user.id, LCGQL.Schema)

      assert {:ok, %{data: %{"viewerContactMatches" => first_page}}} =
               Absinthe.run(query, LCGQL.Schema, variables: %{"first" => 1}, context: context)

      assert [%{"cursor" => first_cursor, "node" => first_node}] = first_page["edges"]
      assert is_binary(first_cursor)
      assert first_node["id"] == first_contact_id
      assert first_node["contactName"] == "Email Match"
      assert first_node["birthday"] == "1990-02-15"
      assert first_node["inviteRecipient"] == matched_email_user.email
      assert [%{"id" => ^matched_email_user_id, "email" => nil}] = first_node["matchedUsers"]

      assert {:ok, %{type: :contact_match}} =
               Absinthe.Relay.Node.from_global_id(first_node["id"], LCGQL.Schema)

      assert {:ok, %{type: :user}} =
               Absinthe.Relay.Node.from_global_id(matched_email_user_id, LCGQL.Schema)

      assert %{"hasNextPage" => true, "endCursor" => end_cursor} = first_page["pageInfo"]
      assert is_binary(end_cursor)

      assert {:ok, %{data: %{"viewerContactMatches" => second_page}}} =
               Absinthe.run(
                 query,
                 LCGQL.Schema,
                 variables: %{"first" => 1, "after" => end_cursor},
                 context: context
               )

      assert [%{"cursor" => second_cursor, "node" => second_node}] = second_page["edges"]
      assert is_binary(second_cursor)
      assert second_node["id"] == second_contact_id
      assert second_node["contactName"] == "Phone Match"
      assert is_nil(second_node["birthday"])
      assert is_nil(second_node["inviteRecipient"])
      assert [%{"id" => ^matched_phone_user_id, "email" => nil}] = second_node["matchedUsers"]

      assert {:ok, %{type: :contact_match}} =
               Absinthe.Relay.Node.from_global_id(second_node["id"], LCGQL.Schema)

      assert {:ok, %{type: :user}} =
               Absinthe.Relay.Node.from_global_id(matched_phone_user_id, LCGQL.Schema)

      assert second_page["pageInfo"]["hasNextPage"] == false
    end

    test "returns an empty connection without an authenticated viewer" do
      query = """
      query {
        viewerContactMatches(first: 5) {
          edges {
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      """

      assert {:ok,
              %{data: %{"viewerContactMatches" => %{"edges" => [], "pageInfo" => page_info}}}} =
               Absinthe.run(query, LCGQL.Schema)

      assert page_info["hasNextPage"] == false
      assert is_nil(page_info["endCursor"])
    end
  end
end
