defmodule LC.Live.MediaSignalingTest do
  use ExUnit.Case, async: true

  alias LC.Live.MediaSignaling

  describe "prepare_live_media_session/0" do
    test "returns deterministic media setup data" do
      assert %{
               ice_servers: ice_servers,
               events: events
             } = MediaSignaling.prepare_live_media_session()

      assert ice_servers == [%{urls: ["stun:stun.l.google.com:19302"]}]

      assert events == %{
               offer: "media:offer",
               answer: "media:answer",
               ice_candidate: "media:ice_candidate"
             }
    end
  end

  describe "validate_offer_payload/1" do
    test "accepts a WebRTC offer description" do
      sdp = "v=0\r\no=- 4611733053425433520 2 IN IP4 127.0.0.1\r\n"

      assert {:ok, %{type: :offer, sdp: ^sdp}} =
               MediaSignaling.validate_offer_payload(%{"type" => "offer", "sdp" => sdp})
    end

    test "returns structured errors for malformed offers" do
      assert {:error,
              [
                %{field: "type", reason: :invalid},
                %{field: "sdp", reason: :required}
              ]} = MediaSignaling.validate_offer_payload(%{"type" => "answer", "sdp" => ""})
    end

    test "rejects whitespace-only and oversized offer SDP" do
      assert {:error, [%{field: "sdp", reason: :required}]} =
               MediaSignaling.validate_offer_payload(%{"type" => "offer", "sdp" => " \n\t "})

      oversized_sdp = String.duplicate("a", 65_537)

      assert {:error, [%{field: "sdp", reason: :too_large}]} =
               MediaSignaling.validate_offer_payload(%{"type" => "offer", "sdp" => oversized_sdp})
    end
  end

  describe "validate_answer_payload/1" do
    test "accepts a WebRTC answer description" do
      sdp = "v=0\r\no=- 4611733053425433520 2 IN IP4 127.0.0.1\r\n"

      assert {:ok, %{type: :answer, sdp: ^sdp}} =
               MediaSignaling.validate_answer_payload(%{type: "answer", sdp: sdp})
    end
  end

  describe "validate_ice_candidate_payload/1" do
    test "accepts an ICE candidate payload" do
      candidate =
        "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx raddr 0.0.0.0 rport 0"

      assert {:ok,
              %{
                candidate: ^candidate,
                sdp_mid: "0",
                sdp_m_line_index: 0,
                username_fragment: "ufrag"
              }} =
               MediaSignaling.validate_ice_candidate_payload(%{
                 "candidate" => candidate,
                 "sdp_mid" => "0",
                 "sdp_m_line_index" => 0,
                 "username_fragment" => "ufrag"
               })
    end

    test "returns structured errors for malformed ICE candidates" do
      assert {:error,
              [
                %{field: "candidate", reason: :required},
                %{field: "sdp_m_line_index", reason: :invalid}
              ]} =
               MediaSignaling.validate_ice_candidate_payload(%{
                 "candidate" => "",
                 "sdp_m_line_index" => -1
               })
    end

    test "rejects whitespace-only and oversized ICE candidates" do
      assert {:error, [%{field: "candidate", reason: :required}]} =
               MediaSignaling.validate_ice_candidate_payload(%{"candidate" => " \n\t "})

      oversized_candidate = String.duplicate("a", 4_097)

      assert {:error, [%{field: "candidate", reason: :too_large}]} =
               MediaSignaling.validate_ice_candidate_payload(%{
                 "candidate" => oversized_candidate
               })
    end

    test "rejects oversized optional ICE candidate strings" do
      candidate =
        "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx raddr 0.0.0.0 rport 0"

      oversized_value = String.duplicate("a", 4_097)

      assert {:error,
              [
                %{field: "sdp_mid", reason: :too_large},
                %{field: "username_fragment", reason: :too_large}
              ]} =
               MediaSignaling.validate_ice_candidate_payload(%{
                 "candidate" => candidate,
                 "sdp_mid" => oversized_value,
                 "username_fragment" => oversized_value
               })
    end
  end

  describe "validate_event_payload/2" do
    test "dispatches known Phoenix media events to their payload validators" do
      sdp = "v=0\r\n"

      assert {:ok, %{type: :offer, sdp: ^sdp}} =
               MediaSignaling.validate_event_payload("media:offer", %{
                 "type" => "offer",
                 "sdp" => sdp
               })

      assert {:error, :unknown_event} =
               MediaSignaling.validate_event_payload("media:unknown", %{})
    end
  end
end
