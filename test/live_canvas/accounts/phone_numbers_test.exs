defmodule LC.Accounts.PhoneNumbersTest do
  use ExUnit.Case, async: true

  alias LC.Accounts.PhoneNumbers

  describe "normalize/1" do
    test "normalizes a valid US number to E.164" do
      assert {:ok, "+16502530000"} = PhoneNumbers.normalize("6502530000")
    end

    test "returns an error for an invalid phone number" do
      assert {:error, :invalid_phone_number} = PhoneNumbers.normalize("123")
    end
  end
end
