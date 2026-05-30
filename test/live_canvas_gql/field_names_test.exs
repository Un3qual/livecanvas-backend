defmodule LCGQL.FieldNamesTest do
  use ExUnit.Case, async: true

  alias LCGQL.FieldNames

  describe "lower_camel/1" do
    test "formats internal atom field names as external GraphQL field names" do
      assert FieldNames.lower_camel(:live_session_id) == "liveSessionId"
      assert FieldNames.lower_camel(:recording_media_asset_id) == "recordingMediaAssetId"
      assert FieldNames.lower_camel(:password_confirmation) == "passwordConfirmation"
      assert FieldNames.lower_camel(:id_token) == "idToken"
      assert FieldNames.lower_camel(:challenge_token) == "challengeToken"
    end
  end
end
