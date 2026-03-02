defmodule LiveCanvas.Accounts.UserTokenTest do
  use LiveCanvas.DataCase

  alias LiveCanvas.Accounts
  alias LiveCanvasSchemas.Accounts.UserToken

  import LiveCanvas.AccountsFixtures

  describe "issue_user_token/3" do
    test "stores only the secret hash" do
      user = user_fixture()

      assert {:ok, %{token: token, user_token: %UserToken{} = persisted}} =
               Accounts.issue_user_token(user, :access_token)

      assert is_binary(token)
      assert persisted.secret_hash != token
      assert persisted.context == :access_token
    end
  end
end
