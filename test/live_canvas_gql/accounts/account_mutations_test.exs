defmodule LCGQL.Accounts.AccountMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts

  describe "registerWithEmail" do
    test "creates a user through the accounts boundary" do
      mutation = """
      mutation {
        registerWithEmail(input: {email: "user@example.com"}) {
          user {
            id
            email
          }
          errors {
            field
            message
          }
          successful
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "registerWithEmail" => %{
                    "user" => %{"id" => user_id, "email" => "user@example.com"},
                    "errors" => [],
                    "successful" => true
                  }
                }
              }} =
               Absinthe.run(mutation, LCGQL.Schema)

      assert is_binary(user_id)
      assert user = Accounts.get_user_by_email("user@example.com")
      assert user.email == "user@example.com"
    end

    test "returns structured errors when the email is already taken" do
      _user = user_fixture(%{email: "duplicate@example.com"})

      mutation = """
      mutation {
        registerWithEmail(input: {email: "duplicate@example.com"}) {
          user {
            id
          }
          errors {
            field
            message
          }
          successful
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "registerWithEmail" => %{
                    "user" => nil,
                    "successful" => false,
                    "errors" => [%{"field" => "email", "message" => _message} | _]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "attachUserPhoneNumber" do
    test "normalizes and persists a phone number through the accounts boundary" do
      user = user_fixture()
      user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LCGQL.Schema)

      mutation = """
      mutation($userId: ID!) {
        attachUserPhoneNumber(input: {userId: $userId, phoneNumber: "(650) 253-0000"}) {
          user {
            id
          }
          errors {
            field
            message
          }
          successful
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "attachUserPhoneNumber" => %{
                    "user" => %{"id" => ^user_id},
                    "errors" => [],
                    "successful" => true
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, variables: %{"userId" => user_id})

      assert persisted_user = Accounts.get_user_by_phone("+1 650-253-0000")
      assert persisted_user.id == user.id
    end
  end

  describe "schema cleanup" do
    test "does not expose the legacy appleAuthenticate stub" do
      schema_sdl = Absinthe.Schema.to_sdl(LCGQL.Schema)

      refute schema_sdl =~ "appleAuthenticate"
    end
  end
end
