defmodule LCTransport.LiveSessionTopicsTest do
  use ExUnit.Case, async: true

  alias LCTransport.LiveSessionTopics

  describe "topic builders" do
    test "builds public live-session transport topics" do
      assert LiveSessionTopics.live_session_topic(123) == "live_session:123"
      assert LiveSessionTopics.session_control_topic(123) == "live_session_control:123"

      assert LiveSessionTopics.session_user_control_topic(123, 456) ==
               "live_session_control:123:user:456"
    end
  end

  describe "parse_live_session_topic/1" do
    test "accepts positive integer live-session topics" do
      assert LiveSessionTopics.parse_live_session_topic("live_session:123") == {:ok, 123}
    end

    test "rejects malformed live-session topics" do
      assert LiveSessionTopics.parse_live_session_topic("live_session:not-a-session-id") ==
               {:error, :invalid_session_id}

      assert LiveSessionTopics.parse_live_session_topic("live_session:0") ==
               {:error, :invalid_session_id}

      assert LiveSessionTopics.parse_live_session_topic("live_session:-1") ==
               {:error, :invalid_session_id}

      assert LiveSessionTopics.parse_live_session_topic("live_session:123abc") ==
               {:error, :invalid_session_id}

      assert LiveSessionTopics.parse_live_session_topic("other:123") ==
               {:error, :invalid_session_id}
    end
  end

  describe "session_id_hint/1" do
    test "returns the parsed ID only for valid live-session topics" do
      assert LiveSessionTopics.session_id_hint("live_session:123") == 123
      assert LiveSessionTopics.session_id_hint("live_session:not-a-session-id") == nil
      assert LiveSessionTopics.session_id_hint(:not_a_topic) == nil
    end
  end
end
