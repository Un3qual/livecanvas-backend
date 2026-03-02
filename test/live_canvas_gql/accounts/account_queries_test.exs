defmodule LiveCanvasGQL.Accounts.AccountQueriesTest do
  use LiveCanvas.DataCase

  import LiveCanvas.AccountsFixtures

  describe "viewer" do
    test "returns the requested user by id" do
      user = user_fixture()
      expected_email = user.email

      query = """
      query($userId: ID!) {
        viewer(userId: $userId) {
          email
        }
      }
      """

      assert {:ok, %{data: %{"viewer" => %{"email" => ^expected_email}}}} =
               Absinthe.run(query, LiveCanvasGQL.Schema, variables: %{"userId" => user.id})
    end
  end
end
