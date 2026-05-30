defmodule LCTransport.LiveSessionReasonsTest do
  use ExUnit.Case, async: true

  alias LCTransport.LiveSessionReasons

  describe "join_error_reason/1" do
    test "keeps documented live-session join reason strings" do
      assert LiveSessionReasons.join_error_reason(:ended) == "session_ended"
      assert LiveSessionReasons.join_error_reason(:not_found) == "session_not_found"
      assert LiveSessionReasons.join_error_reason(:invalid_session_id) == "invalid_session_id"
      assert LiveSessionReasons.join_error_reason(:session_ended) == "session_ended"
      assert LiveSessionReasons.join_error_reason(:not_authorized) == "not_authorized"
      assert LiveSessionReasons.join_error_reason(:rate_limited) == "rate_limited"
    end

    test "redacts distributed runtime failures as unavailable" do
      assert LiveSessionReasons.join_error_reason({:owned_by_remote, :peer@host}) ==
               "session_unavailable"

      assert LiveSessionReasons.join_error_reason(:remote_not_found) == "session_unavailable"
      assert LiveSessionReasons.join_error_reason(:remote_timeout) == "session_unavailable"
      assert LiveSessionReasons.join_error_reason(:remote_unreachable) == "session_unavailable"
    end

    test "falls back to a generic join failure for unknown values" do
      assert LiveSessionReasons.join_error_reason(:unexpected) == "join_failed"
    end
  end

  describe "chat_send_error_reason/1" do
    test "keeps documented chat-send reason strings" do
      assert LiveSessionReasons.chat_send_error_reason(:session_ended) == "session_ended"
      assert LiveSessionReasons.chat_send_error_reason(:not_authorized) == "not_authorized"
      assert LiveSessionReasons.chat_send_error_reason(:invalid_body) == "invalid_body"
      assert LiveSessionReasons.chat_send_error_reason(:rate_limited) == "rate_limited"
    end

    test "redacts changesets as invalid messages" do
      assert LiveSessionReasons.chat_send_error_reason(%Ecto.Changeset{}) ==
               "invalid_message"
    end

    test "does not hide unexpected chat-send failures behind a catch-all" do
      assert_raise FunctionClauseError, fn ->
        apply(LiveSessionReasons, :chat_send_error_reason, [:unexpected])
      end
    end
  end

  describe "disconnect_reason/1" do
    test "keeps documented disconnect reason strings" do
      assert LiveSessionReasons.disconnect_reason(:session_ended) == "session_ended"
      assert LiveSessionReasons.disconnect_reason(:viewer_left) == "viewer_left"
    end
  end
end
