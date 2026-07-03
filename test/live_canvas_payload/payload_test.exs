defmodule LCPayload.PayloadTest do
  use ExUnit.Case, async: true

  alias LCPayload.Payload

  describe "value_for/2" do
    test "reads fixed known atom and string keys without creating atoms" do
      assert Payload.value_for(%{request_id: "atom-request"}, :request_id) == "atom-request"

      assert Payload.value_for(%{"request_id" => "string-request"}, :request_id) ==
               "string-request"

      assert Payload.value_for(%{}, :request_id) == nil
      assert Payload.value_for(%{"request_id" => "string-request"}, "request_id") == nil
    end
  end

  describe "positive_integer/2" do
    test "accepts positive integer values under atom and string keys" do
      assert Payload.positive_integer(%{media_asset_id: 123}, :media_asset_id) == {:ok, 123}
      assert Payload.positive_integer(%{"media_asset_id" => 456}, :media_asset_id) == {:ok, 456}
    end

    test "rejects missing or non-positive payload identifiers" do
      invalid_payloads = [
        %{},
        %{media_asset_id: nil},
        %{media_asset_id: 0},
        %{media_asset_id: -1},
        %{media_asset_id: "123"},
        %{media_asset_id: 12.5},
        [],
        nil
      ]

      for payload <- invalid_payloads do
        assert Payload.positive_integer(payload, :media_asset_id) == {:error, :invalid_payload}
      end
    end

    test "rejects non-atom keys" do
      assert Payload.positive_integer(%{"media_asset_id" => 123}, "media_asset_id") ==
               {:error, :invalid_payload}
    end
  end
end
