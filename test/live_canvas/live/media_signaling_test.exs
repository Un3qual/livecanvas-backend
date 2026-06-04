defmodule LC.Live.MediaSignalingTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

  alias LC.Live.MediaSignaling

  defmodule EphemeralIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(opts) do
      nonce = Keyword.fetch!(opts, :nonce)

      {:ok,
       [
         %{
           urls: ["turns:turn.livecanvas.test:443"],
           username: "live-session:#{nonce}",
           credential: "turn-credential:#{nonce}",
           credential_type: :password
         }
       ]}
    end
  end

  defmodule ConfigurableIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(opts), do: {:ok, [Keyword.fetch!(opts, :ice_server)]}
  end

  defmodule FailingIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: {:error, :turn_unavailable}
  end

  defmodule RaisingIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: raise(RuntimeError, "turn secret leaked")
  end

  defmodule ExitingIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: exit({:turn_secret_leaked, "turn secret leaked"})
  end

  defmodule ThrowingIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: throw({:turn_secret_leaked, "turn secret leaked"})
  end

  defmodule InvalidIceServerProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: {:ok, [%{urls: []}]}
  end

  defmodule InvalidIceServerSchemeProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: {:ok, [%{urls: ["https://turn.livecanvas.test"]}]}
  end

  defmodule EmptyIceServerSchemeProvider do
    @behaviour MediaSignaling

    @impl MediaSignaling
    def ice_servers(_opts), do: {:ok, [%{urls: ["turns:"]}]}
  end

  describe "prepare_live_media_session/0" do
    test "returns deterministic media setup data" do
      assert {:ok,
              %{
                ice_servers: ice_servers,
                events: events
              }} = MediaSignaling.prepare_live_media_session()

      assert ice_servers == [%{urls: ["stun:stun.l.google.com:19302"]}]

      assert events == %{
               offer: "media:offer",
               answer: "media:answer",
               ice_candidate: "media:ice_candidate"
             }
    end

    test "returns ICE servers from an explicit configured provider" do
      assert {:ok,
              %{
                ice_servers: [
                  %{
                    urls: ["turns:turn.livecanvas.test:443"],
                    username: "live-session:test-nonce",
                    credential: "turn-credential:test-nonce",
                    credential_type: :password
                  }
                ]
              }} =
               MediaSignaling.prepare_live_media_session(
                 provider: EphemeralIceServerProvider,
                 provider_config: [nonce: "test-nonce"]
               )
    end

    test "returns provider failures as tagged errors" do
      log =
        capture_log(fn ->
          assert {:error, :ice_server_provider_failed} =
                   MediaSignaling.prepare_live_media_session(provider: FailingIceServerProvider)
        end)

      assert log =~ "live media ICE server provider failed"
      refute log =~ "turn_unavailable"
    end

    test "returns provider exceptions as tagged errors" do
      log =
        capture_log(fn ->
          assert {:error, :ice_server_provider_failed} =
                   MediaSignaling.prepare_live_media_session(provider: RaisingIceServerProvider)
        end)

      assert log =~ "live media ICE server provider failed"
      refute log =~ "turn secret leaked"
    end

    test "returns provider exits as tagged errors" do
      log =
        capture_log(fn ->
          assert {:error, :ice_server_provider_failed} =
                   MediaSignaling.prepare_live_media_session(provider: ExitingIceServerProvider)
        end)

      assert log =~ "live media ICE server provider failed"
      refute log =~ "turn secret leaked"
    end

    test "returns provider throws as tagged errors" do
      log =
        capture_log(fn ->
          assert {:error, :ice_server_provider_failed} =
                   MediaSignaling.prepare_live_media_session(provider: ThrowingIceServerProvider)
        end)

      assert log =~ "live media ICE server provider failed"
      refute log =~ "turn secret leaked"
    end

    test "rejects malformed ICE server payloads from providers" do
      log =
        capture_log(fn ->
          assert {:error, :invalid_ice_server_config} =
                   MediaSignaling.prepare_live_media_session(provider: InvalidIceServerProvider)
        end)

      assert log =~ "live media ICE server provider returned invalid server configuration"
    end

    test "rejects incomplete ICE server credential fields from providers" do
      assert_invalid_ice_server(%{
        urls: ["turns:turn.livecanvas.test:443"],
        credential_type: :password
      })

      assert_invalid_ice_server(%{
        urls: ["turns:turn.livecanvas.test:443"],
        username: "live-session:test-nonce"
      })

      assert_invalid_ice_server(%{
        urls: ["turns:turn.livecanvas.test:443"],
        credential: "turn-credential:test-nonce"
      })
    end

    test "rejects unsupported ICE server URL schemes from providers" do
      log =
        capture_log(fn ->
          assert {:error, :invalid_ice_server_config} =
                   MediaSignaling.prepare_live_media_session(
                     provider: InvalidIceServerSchemeProvider
                   )
        end)

      assert log =~ "live media ICE server provider returned invalid server configuration"
    end

    test "rejects ICE server URLs without a scheme body" do
      log =
        capture_log(fn ->
          assert {:error, :invalid_ice_server_config} =
                   MediaSignaling.prepare_live_media_session(
                     provider: EmptyIceServerSchemeProvider
                   )
        end)

      assert log =~ "live media ICE server provider returned invalid server configuration"
    end
  end

  defp assert_invalid_ice_server(ice_server) do
    log =
      capture_log(fn ->
        assert {:error, :invalid_ice_server_config} =
                 MediaSignaling.prepare_live_media_session(
                   provider: ConfigurableIceServerProvider,
                   provider_config: [ice_server: ice_server]
                 )
      end)

    assert log =~ "live media ICE server provider returned invalid server configuration"
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
