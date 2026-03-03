defmodule LiveCanvasSchemas.IDConventionsTest do
  use LiveCanvas.DataCase, async: true

  alias LiveCanvasSchemas.Accounts.{User, UserEmailAddress, UserToken}

  describe "schema id conventions" do
    test "relational user schema keeps bigint id and adds entropy_id" do
      assert :id == User.__schema__(:type, :id)
      assert :entropy_id in User.__schema__(:fields)
    end

    test "join schema keeps bigint id and adds entropy_id" do
      assert :id == UserEmailAddress.__schema__(:type, :id)
      assert :entropy_id in UserEmailAddress.__schema__(:fields)
    end

    test "user token remains uuid-primary-key exception without entropy_id" do
      assert :binary_id == UserToken.__schema__(:type, :id)
      refute :entropy_id in UserToken.__schema__(:fields)
    end
  end
end
