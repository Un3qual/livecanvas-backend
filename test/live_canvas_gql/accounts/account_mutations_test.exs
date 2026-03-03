defmodule LiveCanvasGQL.Accounts.AccountMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts

  describe "registerWithEmail" do
    test "creates a user through the accounts boundary" do
      mutation = """
      mutation {
        registerWithEmail(input: {email: "user@example.com"}) {
          successful
        }
      }
      """

      assert {:ok, %{data: %{"registerWithEmail" => %{"successful" => true}}}} =
               Absinthe.run(mutation, LiveCanvasGQL.Schema)

      assert user = Accounts.get_user_by_email("user@example.com")
      assert user.email == "user@example.com"
    end
  end

  describe "attachUserPhoneNumber" do
    test "normalizes and persists a phone number through the accounts boundary" do
      user = user_fixture()

      mutation = """
      mutation($userId: ID!) {
        attachUserPhoneNumber(input: {userId: $userId, phoneNumber: "(650) 253-0000"}) {
          successful
        }
      }
      """

      assert {:ok, %{data: %{"attachUserPhoneNumber" => %{"successful" => true}}}} =
               Absinthe.run(mutation, LiveCanvasGQL.Schema, variables: %{"userId" => user.id})

      assert persisted_user = Accounts.get_user_by_phone("+1 650-253-0000")
      assert persisted_user.id == user.id
    end
  end

  describe "schema cleanup" do
    test "does not expose the legacy appleAuthenticate stub" do
      schema_sdl = Absinthe.Schema.to_sdl(LiveCanvasGQL.Schema)

      refute schema_sdl =~ "appleAuthenticate"
    end
  end
end
