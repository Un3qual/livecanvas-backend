defmodule LCGQL.MutationErrorsTest do
  use ExUnit.Case, async: true

  alias LCGQL.FieldNames
  alias LCGQL.MutationErrors

  describe "user_error/2" do
    test "formats nil-field atom reasons" do
      assert MutationErrors.user_error(nil, :unauthenticated) == %{
               field: nil,
               message: "unauthenticated"
             }
    end

    test "formats field-specific atom reasons" do
      assert MutationErrors.user_error("postId", :not_found) == %{
               field: "postId",
               message: "not_found"
             }
    end
  end

  describe "invalid_error/1" do
    test "uses the public invalid input message" do
      assert MutationErrors.invalid_error("liveSessionId") == %{
               field: "liveSessionId",
               message: "is invalid"
             }
    end
  end

  describe "auth_error/3" do
    test "keeps auth code and custom message" do
      assert MutationErrors.auth_error(
               "password.email",
               :email_taken,
               "has already been taken"
             ) == %{
               field: "password.email",
               code: :email_taken,
               message: "has already been taken"
             }
    end

    test "defaults nil messages to the code string" do
      assert MutationErrors.auth_error(nil, :invalid_input, nil) == %{
               field: nil,
               code: :invalid_input,
               message: "invalid_input"
             }
    end
  end

  describe "changeset_errors/2" do
    test "interpolates messages and applies the field mapper" do
      changeset =
        {%{}, %{password: :string}}
        |> Ecto.Changeset.cast(%{password: "short"}, [:password])
        |> Ecto.Changeset.add_error(
          :password,
          "should be at least %{count} character(s)",
          count: 8
        )

      assert MutationErrors.changeset_errors(changeset, &Atom.to_string/1) == [
               %{field: "password", message: "should be at least 8 character(s)"}
             ]
    end
  end

  describe "auth_changeset_errors/3" do
    test "prefixes mapped fields and interpolates messages as invalid input" do
      changeset =
        {%{}, %{password_confirmation: :string}}
        |> Ecto.Changeset.cast(%{password_confirmation: "short"}, [:password_confirmation])
        |> Ecto.Changeset.add_error(
          :password_confirmation,
          "should be at least %{count} character(s)",
          count: 8
        )

      assert MutationErrors.auth_changeset_errors(
               changeset,
               "password",
               &FieldNames.lower_camel/1
             ) ==
               [
                 %{
                   field: "password.passwordConfirmation",
                   code: :invalid_input,
                   message: "should be at least 8 character(s)"
                 }
               ]
    end
  end
end
