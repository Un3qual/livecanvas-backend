defmodule LCWeb.LiveSessionChannelTest do
  use LC.DataCase, async: false
  import Phoenix.ChannelTest

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Live}
  alias LC.Infra.Repo
  alias LC.Live.SessionServer
  alias LC.RealtimeRuntime
  alias LCTransport.LiveSessionTopics
  alias LCSchemas.Live.{LiveParticipant, LiveSession}
  alias LCWeb.{LiveSessionChannel, UserSocket}

  @endpoint LCWeb.Endpoint
  @channel_reply_timeout 1_000
  @live_channel_telemetry_events [
    [:live_canvas, :live, :channel, :join],
    [:live_canvas, :live, :channel, :chat_send]
  ]

  setup do
    attach_live_channel_telemetry_handler()
    :ok
  end

  test "authorized viewer receives the bounded aggregate session state in the join ack" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok,
            %{
              session_state: %{
                status: :starting,
                visibility: :public,
                viewer_count: 1
              }
            }, _socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )
  end

  test "published session state is re-read from persistence before broadcasting" do
    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    updated_session =
      session
      |> Ecto.Changeset.change(visibility: :followers)
      |> Repo.update!()

    assert LCWeb.LiveSessionChannel.published_session_state(session.id, session) == %{
             session_state: %{
               status: :starting,
               visibility: :followers,
               viewer_count: 0
             }
           }

    assert LCWeb.LiveSessionChannel.published_session_state(updated_session.id, updated_session) ==
             %{
               session_state: %{
                 status: :starting,
                 visibility: :followers,
                 viewer_count: 0
               }
             }
  end

  test "joins and disconnect-driven leaves rebroadcast session state on the same topic" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    second_viewer = user_fixture()
    other_host = user_fixture(privacy_mode: :public)
    other_viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, other_session} = Live.start_live_session(other_host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)
    other_session_topic = LiveSessionTopics.live_session_topic(other_session.id)

    assert {:ok, _join_payload, _first_socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert {:ok, _other_join_payload, _other_socket} =
             subscribe_and_join(
               socket_for(other_viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(other_session.id)
             )

    assert_receive %Phoenix.Socket.Broadcast{
      topic: ^other_session_topic,
      event: "session:state",
      payload: %{
        session_state: %{
          status: :starting,
          visibility: :public,
          viewer_count: 1
        }
      }
    }

    assert {:ok,
            %{
              session_state: %{
                status: :starting,
                visibility: :public,
                viewer_count: 2
              }
            }, second_socket} =
             subscribe_and_join(
               socket_for(second_viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert_receive %Phoenix.Socket.Broadcast{
      topic: ^session_topic,
      event: "session:state",
      payload: %{
        session_state: %{
          status: :starting,
          visibility: :public,
          viewer_count: 2
        }
      }
    }

    refute_receive %Phoenix.Socket.Broadcast{
      topic: ^other_session_topic,
      event: "session:state"
    }

    assert :ok = close(second_socket)
    assert :ok = wait_for_participant_left(session.id, second_viewer.id)

    assert_receive %Phoenix.Socket.Broadcast{
      topic: ^session_topic,
      event: "session:state",
      payload: %{
        session_state: %{
          status: :starting,
          visibility: :public,
          viewer_count: 1
        }
      }
    }

    refute_receive %Phoenix.Socket.Broadcast{
      topic: ^other_session_topic,
      event: "session:state"
    }
  end

  test "sending timeline:chat_message:send persists and broadcasts the timeline event payload" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               session_topic
             )

    ref = push(socket, "timeline:chat_message:send", %{"body" => "hello"})
    actor_id = viewer.id
    actor_global_id = Absinthe.Relay.Node.to_global_id(:user, actor_id, LCGQL.Schema)

    assert_reply ref,
                 :ok,
                 %{
                   event: %{
                     __typename: "ChatMessageEvent",
                     event_type: "chat_message_sent",
                     body: "hello",
                     id: event_global_id,
                     actor: %{id: ^actor_global_id},
                     occurred_at: occurred_at,
                     edited: false,
                     edit_count: 0,
                     edited_at: nil
                   }
                 },
                 @channel_reply_timeout

    assert is_binary(event_global_id)
    event_id = decode_global_node_id(event_global_id, :chat_message_event)
    assert {:ok, _, 0} = DateTime.from_iso8601(occurred_at)

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{
        event: %{
          __typename: "ChatMessageEvent",
          event_type: "chat_message_sent",
          body: "hello",
          id: ^event_global_id,
          actor: %{id: ^actor_global_id},
          occurred_at: ^occurred_at,
          edited: false,
          edit_count: 0,
          edited_at: nil
        }
      }
    }

    assert %{
             id: ^event_id,
             body: "hello",
             actor_user_id: ^actor_id,
             event_type: :chat_message_sent
           } = Chat.get_timeline_event(viewer, event_id)
  end

  test "sending timeline:chat_message:send rejects stale sockets after session end" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               session_topic
             )

    {:ok, _ended_session} = Live.end_live_session(session)

    ref = push(socket, "timeline:chat_message:send", %{"body" => "too late"})

    assert_reply ref, :error, %{reason: "session_ended"}

    refute_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event"
    }
  end

  test "media:offer uses the server-derived host sender role" do
    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               signaling_topic
             )

    sdp = "v=0\r\no=- 4611733053425433520 2 IN IP4 127.0.0.1\r\n"

    payload = %{
      "type" => "offer",
      "sdp" => sdp,
      "sender_role" => "viewer"
    }

    expected_payload = %{type: "offer", sdp: sdp, sender_role: "host"}
    ref = push(socket, "media:offer", payload)

    assert_reply ref, :ok, ^expected_payload

    assert_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:offer",
      payload: ^expected_payload
    }

    refute_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "media:offer"
    }

    assert {:not_ready, :media_not_ready} = Live.media_negotiation_ready?(session.id)
  end

  test "media signaling topic join does not create live participants or session-state broadcasts" do
    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, _socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               signaling_topic
             )

    assert Repo.get_by(LiveParticipant, live_session_id: session.id, user_id: host.id) == nil

    refute_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "session:state"
    }
  end

  test "media:answer requires a backend-observed host offer before marking readiness" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               signaling_topic
             )

    ref = push(socket, "media:answer", %{"type" => "answer", "sdp" => "v=0\r\n"})

    assert_reply ref, :error, %{reason: "not_authorized"}, @channel_reply_timeout

    refute_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:answer"
    }

    assert {:not_ready, :media_not_ready} = Live.media_negotiation_ready?(session.id)
  end

  test "media:answer uses the server-derived viewer sender role after a host offer" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)

    assert {:ok, _join_payload, host_socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               signaling_topic
             )

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               signaling_topic
             )

    offer_sdp = "v=0\r\no=- 4611733053425433520 2 IN IP4 127.0.0.1\r\n"
    offer_payload = %{type: "offer", sdp: offer_sdp, sender_role: "host"}
    offer_ref = push(host_socket, "media:offer", %{"type" => "offer", "sdp" => offer_sdp})

    assert_reply offer_ref, :ok, ^offer_payload, @channel_reply_timeout

    assert_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:offer",
      payload: ^offer_payload
    }

    assert_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:offer",
      payload: ^offer_payload
    }

    sdp = "v=0\r\no=- 4611733053425433520 2 IN IP4 127.0.0.1\r\n"
    expected_payload = %{type: "answer", sdp: sdp, sender_role: "viewer"}
    ref = push(socket, "media:answer", %{"type" => "answer", "sdp" => sdp})

    assert_reply ref, :ok, ^expected_payload, @channel_reply_timeout

    assert_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:answer",
      payload: ^expected_payload
    }

    assert :ready = Live.media_negotiation_ready?(session.id)
  end

  test "media:answer requires an active live-session participant before marking readiness" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               signaling_topic
             )

    ref = push(socket, "media:answer", %{"type" => "answer", "sdp" => "v=0\r\n"})

    assert_reply ref, :error, %{reason: "not_authorized"}, @channel_reply_timeout

    refute_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:answer"
    }

    assert {:not_ready, :media_not_ready} = Live.media_negotiation_ready?(session.id)
  end

  test "closing media signaling sockets preserves joined live-session participants" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, _session_socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert {:ok, runtime_pid} = Live.lookup_session_server(session.id)
    assert %{participants: participants_before_close} = SessionServer.snapshot(runtime_pid)
    assert Map.has_key?(participants_before_close, viewer.id)

    assert {:ok, _join_payload, media_socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.media_signaling_topic(session.id)
             )

    monitor_ref = Process.monitor(media_socket.channel_pid)

    assert :ok = close(media_socket)
    assert_receive {:DOWN, ^monitor_ref, :process, _, _}

    assert %LiveParticipant{left_at: nil} =
             Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

    assert %{participants: participants_after_close} = SessionServer.snapshot(runtime_pid)
    assert Map.has_key?(participants_after_close, viewer.id)
  end

  test "media:ice_candidate broadcasts validated candidate fields" do
    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               signaling_topic
             )

    candidate =
      "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx raddr 0.0.0.0 rport 0"

    expected_payload = %{
      candidate: candidate,
      sdp_mid: "0",
      sdp_m_line_index: 0,
      username_fragment: "ufrag",
      sender_role: "host"
    }

    ref =
      push(socket, "media:ice_candidate", %{
        "candidate" => candidate,
        "sdp_mid" => "0",
        "sdp_m_line_index" => 0,
        "username_fragment" => "ufrag"
      })

    assert_reply ref, :ok, ^expected_payload

    assert_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:ice_candidate",
      payload: ^expected_payload
    }
  end

  test "media:ice_candidate requires the host or an active live-session participant" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               signaling_topic
             )

    candidate =
      "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx raddr 0.0.0.0 rport 0"

    ref =
      push(socket, "media:ice_candidate", %{
        "candidate" => candidate
      })

    assert_reply ref, :error, %{reason: "not_authorized"}, @channel_reply_timeout

    refute_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:ice_candidate"
    }

    assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)

    expected_payload = %{
      candidate: candidate,
      sender_role: "viewer"
    }

    active_ref =
      push(socket, "media:ice_candidate", %{
        "candidate" => candidate
      })

    assert_reply active_ref, :ok, ^expected_payload, @channel_reply_timeout

    assert_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:ice_candidate",
      payload: ^expected_payload
    }
  end

  test "media offers are host-only and media events are rejected on the shared session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, viewer_signal_socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               signaling_topic
             )

    assert {:ok, _join_payload, host_session_socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               session_topic
             )

    sdp = "v=0\r\n"

    viewer_ref = push(viewer_signal_socket, "media:offer", %{"type" => "offer", "sdp" => sdp})
    assert_reply viewer_ref, :error, %{reason: "not_authorized"}, @channel_reply_timeout

    host_ref = push(host_session_socket, "media:offer", %{"type" => "offer", "sdp" => sdp})
    assert_reply host_ref, :error, %{reason: "not_authorized"}, @channel_reply_timeout

    refute_receive %Phoenix.Socket.Message{
      event: "media:offer"
    }
  end

  test "rate limits repeated media signaling events for the same viewer" do
    previous_rate_limit_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      Keyword.put(previous_rate_limit_config, :limits,
        channel_join: [limit: 10, window_ms: 60_000],
        media_signal: [limit: 1, window_ms: 60_000]
      )
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_rate_limit_config)
      LC.RateLimiter.reset!()
    end)

    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               signaling_topic
             )

    first_ref = push(socket, "media:offer", %{"type" => "offer", "sdp" => "v=0\r\n"})
    assert_reply first_ref, :ok, %{sender_role: "host"}, @channel_reply_timeout

    second_ref =
      push(socket, "media:ice_candidate", %{
        "candidate" => "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ host"
      })

    assert_reply second_ref, :error, %{reason: "rate_limited"}, @channel_reply_timeout
  end

  test "media signaling returns structured validation errors" do
    host = user_fixture(privacy_mode: :public)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(host),
               LiveSessionChannel,
               signaling_topic
             )

    ref = push(socket, "media:offer", %{"type" => "answer", "sdp" => ""})

    assert_reply ref, :error, %{
      reason: "invalid_media_payload",
      errors: [
        %{field: "type", reason: "invalid"},
        %{field: "sdp", reason: "required"}
      ]
    }

    refute_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:offer"
    }
  end

  test "media signaling rejects stale sockets after session end" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    signaling_topic = LiveSessionTopics.media_signaling_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               signaling_topic
             )

    {:ok, _ended_session} = Live.end_live_session(session)

    ref = push(socket, "media:answer", %{"type" => "answer", "sdp" => "v=0\r\n"})

    assert_reply ref, :error, %{reason: "session_ended"}

    refute_receive %Phoenix.Socket.Message{
      topic: ^signaling_topic,
      event: "media:answer"
    }
  end

  test "editLiveChatMessage broadcasts timeline event updates to joined clients" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    session_topic = LiveSessionTopics.live_session_topic(session.id)

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               session_topic
             )

    send_ref = push(socket, "timeline:chat_message:send", %{"body" => "hello"})
    actor_global_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

    assert_reply send_ref,
                 :ok,
                 %{
                   event: %{
                     body: "hello",
                     id: event_global_id,
                     actor: %{id: ^actor_global_id}
                   }
                 },
                 @channel_reply_timeout

    _event_id = decode_global_node_id(event_global_id, :chat_message_event)

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{event: %{id: ^event_global_id, body: "hello"}}
    }

    chat_message_event_id = event_global_id

    context = %{current_scope: Accounts.scope_for_user(viewer)}

    assert {:ok,
            %{
              data: %{
                "editLiveChatMessage" => %{
                  "chatMessageEvent" => %{
                    "id" => ^chat_message_event_id,
                    "body" => "hello, world",
                    "edited" => true,
                    "editCount" => 1
                  },
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(
               edit_message_mutation(),
               LCGQL.Schema,
               context: context,
               variables: %{
                 "chatMessageEventId" => chat_message_event_id,
                 "body" => "hello, world"
               }
             )

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event_updated",
      payload: %{
        event: %{
          __typename: "ChatMessageEvent",
          id: ^event_global_id,
          body: "hello, world",
          actor: %{id: ^actor_global_id},
          edited: true,
          edit_count: 1
        }
      }
    }
  end

  test "removeLiveChatMessageEvent accepts a chat message event id from a channel context" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    other_host = user_fixture(privacy_mode: :public)
    other_viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, other_session} = Live.start_live_session(other_host, %{visibility: :public})

    assert {:ok, _join_payload, viewer_socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert {:ok, _join_payload, _other_viewer_socket} =
             subscribe_and_join(
               socket_for(other_viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(other_session.id)
             )

    send_ref = push(viewer_socket, "timeline:chat_message:send", %{"body" => "abusive message"})
    actor_global_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

    assert_reply send_ref,
                 :ok,
                 %{
                   event: %{
                     body: "abusive message",
                     id: event_global_id,
                     actor: %{id: ^actor_global_id}
                   }
                 },
                 @channel_reply_timeout

    event_id = decode_global_node_id(event_global_id, :chat_message_event)
    session_topic = LiveSessionTopics.live_session_topic(session.id)

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{event: %{body: "abusive message", id: ^event_global_id}}
    }

    chat_message_event_id = event_global_id

    context = %{current_scope: Accounts.scope_for_user(host)}
    other_session_topic = LiveSessionTopics.live_session_topic(other_session.id)

    assert {:ok,
            %{
              data: %{
                "removeLiveChatMessageEvent" => %{
                  "removedTimelineEventId" => ^chat_message_event_id,
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(
               remove_message_mutation(),
               LCGQL.Schema,
               context: context,
               variables: %{"chatMessageEventId" => chat_message_event_id}
             )

    assert Chat.get_timeline_event(host, event_id) == nil

    refute_receive %Phoenix.Socket.Message{
      topic: ^other_session_topic,
      event: "timeline:event_removed"
    }

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event_removed",
      payload: %{removed_timeline_event_id: ^chat_message_event_id}
    }

    refute_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{event: %{event_type: "chat_message_removed"}}
    }
  end

  test "removeLiveChatMessageEvent returns not_found for repeated hidden event removals" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, viewer_socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    send_ref = push(viewer_socket, "timeline:chat_message:send", %{"body" => "remove once"})
    actor_global_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

    assert_reply send_ref,
                 :ok,
                 %{
                   event: %{
                     id: event_global_id,
                     actor: %{id: ^actor_global_id}
                   }
                 },
                 @channel_reply_timeout

    _event_id = decode_global_node_id(event_global_id, :chat_message_event)
    session_topic = LiveSessionTopics.live_session_topic(session.id)

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{event: %{body: "remove once", id: ^event_global_id}}
    }

    chat_message_event_id = event_global_id

    context = %{current_scope: Accounts.scope_for_user(host)}

    assert {:ok,
            %{
              data: %{
                "removeLiveChatMessageEvent" => %{
                  "removedTimelineEventId" => ^chat_message_event_id,
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(
               remove_message_mutation(),
               LCGQL.Schema,
               context: context,
               variables: %{"chatMessageEventId" => chat_message_event_id}
             )

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event_removed",
      payload: %{removed_timeline_event_id: ^chat_message_event_id}
    }

    assert {:ok,
            %{
              data: %{
                "removeLiveChatMessageEvent" => %{
                  "removedTimelineEventId" => nil,
                  "errors" => [%{"field" => nil, "message" => "not_found"}]
                }
              }
            }} =
             Absinthe.run(
               remove_message_mutation(),
               LCGQL.Schema,
               context: context,
               variables: %{"chatMessageEventId" => chat_message_event_id}
             )

    refute_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event_removed"
    }

    refute_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{event: %{event_type: "chat_message_removed"}}
    }
  end

  test "viewer who muted host cannot join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    _mute = mute_fixture(viewer, host)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:error, %{reason: "not_authorized"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :not_authorized,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "join returns the documented client-safe failure reasons" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, ended_session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, _ended_session} = Live.end_live_session(ended_session)

    assert {:error, %{reason: "invalid_session_id"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:not-a-session-id"
             )

    assert {:error, %{reason: "session_not_found"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id + ended_session.id + 10_000)
             )

    assert {:error, %{reason: "session_ended"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(ended_session.id)
             )
  end

  test "remote-owned session returns session_unavailable and emits remote_unreachable telemetry" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    session = live_session_fixture(host.id)
    remote_owner = "remote-owner@127.0.0.1"

    put_remote_owner(session, remote_owner)

    assert {:error, %{reason: "session_unavailable"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :remote_unreachable,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "suspended viewer cannot join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    assert {:ok, _suspended_viewer} = Accounts.suspend_user(viewer)

    assert {:error, %{reason: "not_authorized"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )
  end

  test "rate limits repeated join attempts for the same viewer" do
    previous_rate_limit_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      Keyword.put(previous_rate_limit_config, :limits,
        channel_join: [limit: 1, window_ms: 60_000]
      )
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_rate_limit_config)
      LC.RateLimiter.reset!()
    end)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, _socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert {:error, %{reason: "rate_limited"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :rate_limited,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "rate limits repeated chat sends for the same viewer" do
    previous_rate_limit_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      Keyword.put(previous_rate_limit_config, :limits,
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 1, window_ms: 60_000]
      )
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_rate_limit_config)
      LC.RateLimiter.reset!()
    end)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    first_ref = push(socket, "timeline:chat_message:send", %{"body" => "first"})
    assert_reply first_ref, :ok, %{event: %{body: "first"}}, @channel_reply_timeout

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :chat_send], %{count: 1},
                    %{
                      result: :ok,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id

    second_ref = push(socket, "timeline:chat_message:send", %{"body" => "second"})
    assert_reply second_ref, :error, %{reason: "rate_limited"}, @channel_reply_timeout

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :chat_send], %{count: 1},
                    %{
                      result: :error,
                      reason: :rate_limited,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "invalid chat payload emits telemetry and returns invalid_body" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    ref = push(socket, "timeline:chat_message:send", %{"body" => 42})
    assert_reply ref, :error, %{reason: "invalid_body"}, @channel_reply_timeout

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :chat_send], %{count: 1},
                    %{
                      result: :error,
                      reason: :invalid_body,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "join and chat telemetry include request and trace correlation metadata from the socket" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    request_id = "socket-request-id-1234567890"
    trace_id = String.duplicate("c", 32)
    viewer_id = viewer.id
    session_id = session.id

    socket =
      connected_socket_for(viewer, %{
        "request_id" => request_id,
        "trace_id" => trace_id
      })

    assert %{request_id: ^request_id, trace_id: ^trace_id, viewer_id: ^viewer_id} =
             socket.assigns.observability_context

    refute Map.has_key?(socket.assigns.observability_context, :token)

    assert {:ok, _join_payload, joined_socket} =
             subscribe_and_join(
               socket,
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session_id)
             )

    assert %{live_session_id: ^session_id} = joined_socket.assigns.observability_context

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      request_id: ^request_id,
                      trace_id: ^trace_id,
                      session_id: ^session_id,
                      user_id: ^viewer_id,
                      result: :ok
                    }}

    ref = push(joined_socket, "timeline:chat_message:send", %{"body" => "hello with trace"})

    assert_reply ref, :ok, %{event: %{body: "hello with trace"}}, @channel_reply_timeout

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :chat_send], %{count: 1},
                    %{
                      request_id: ^request_id,
                      trace_id: ^trace_id,
                      session_id: ^session_id,
                      user_id: ^viewer_id,
                      result: :ok
                    }}
  end

  test "chat send does not regenerate correlation ids when the socket already has observability context" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    socket =
      connected_socket_for(viewer, %{
        "request_id" => "socket-request-id-1234567890",
        "trace_id" => String.duplicate("d", 32)
      })

    assert {:ok, _join_payload, joined_socket} =
             subscribe_and_join(
               socket,
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    channel_pid = joined_socket.channel_pid

    :erlang.trace_pattern({:crypto, :strong_rand_bytes, 1}, true, [:local])
    :erlang.trace(channel_pid, true, [:call])

    on_exit(fn ->
      if Process.alive?(channel_pid) do
        :erlang.trace(channel_pid, false, [:call])
      end

      :erlang.trace_pattern({:crypto, :strong_rand_bytes, 1}, false, [:local])
    end)

    ref = push(joined_socket, "timeline:chat_message:send", %{"body" => "no new ids"})

    assert_reply ref, :ok, %{event: %{body: "no new ids"}}, @channel_reply_timeout

    refute_receive {:trace, ^channel_pid, :call, {:crypto, :strong_rand_bytes, [_]}}, 50
  end

  test "disconnect marks participant left and prunes runtime membership" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert {:ok, pid} = Live.lookup_session_server(session.id)
    assert %{participants: participants_before_leave} = SessionServer.snapshot(pid)
    assert Map.has_key?(participants_before_leave, viewer.id)

    session_topic = LiveSessionTopics.live_session_topic(session.id)

    assert :ok = close(socket)

    assert_receive %Phoenix.Socket.Broadcast{
      topic: ^session_topic,
      event: "session:state",
      payload: %{
        session_state: %{
          status: :starting,
          visibility: :public,
          viewer_count: 0
        }
      }
    }

    assert :ok = wait_for_participant_left(session.id, viewer.id)

    assert %LiveParticipant{left_at: %DateTime{}} =
             Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

    assert %{participants: participants_after_leave} = SessionServer.snapshot(pid)
    refute Map.has_key?(participants_after_leave, viewer.id)
  end

  test "endLiveSession disconnects already-joined viewers" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    host_id = host.id
    host_global_id = Absinthe.Relay.Node.to_global_id(:user, host_id, LCGQL.Schema)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    monitor_ref = Process.monitor(socket.channel_pid)

    session_id = Absinthe.Relay.Node.to_global_id(:live_session, session.id, LCGQL.Schema)
    context = %{current_scope: Accounts.scope_for_user(host)}
    session_topic = LiveSessionTopics.live_session_topic(session.id)
    control_topic = LiveSessionTopics.session_control_topic(session.id)
    :ok = Phoenix.PubSub.subscribe(LC.PubSub, control_topic)
    assert :ok = Live.mark_media_negotiation_ready(session.id)

    go_live_mutation = """
    mutation GoLiveSession($liveSessionId: ID!) {
      goLiveSession(input: {liveSessionId: $liveSessionId}) {
        liveSession {
          id
          status
        }
        errors {
          message
        }
      }
    }
    """

    mutation = """
    mutation EndLiveSession($liveSessionId: ID!) {
      endLiveSession(input: {liveSessionId: $liveSessionId}) {
        liveSession {
          id
          status
        }
        errors {
          message
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "goLiveSession" => %{
                  "liveSession" => %{"id" => ^session_id, "status" => "LIVE"},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(
               go_live_mutation,
               LCGQL.Schema,
               context: context,
               variables: %{"liveSessionId" => session_id}
             )

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{
        event: %{
          __typename: "LiveSessionStartedEvent",
          id: go_live_event_id,
          event_type: "live_session_started",
          occurred_at: go_live_occurred_at,
          actor: %{id: ^host_global_id}
        }
      }
    }

    assert is_binary(go_live_event_id)
    _go_live_local_id = decode_global_node_id(go_live_event_id, :live_session_started_event)
    assert is_binary(go_live_occurred_at)

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "session:state",
      payload: %{
        session_state: %{
          status: :live,
          visibility: :public,
          viewer_count: 1
        }
      }
    }

    assert {:ok,
            %{
              data: %{
                "endLiveSession" => %{
                  "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(
               mutation,
               LCGQL.Schema,
               context: context,
               variables: %{"liveSessionId" => session_id}
             )

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "timeline:event",
      payload: %{
        event: %{
          __typename: "LiveSessionEndedEvent",
          id: end_event_id,
          event_type: "live_session_ended",
          occurred_at: end_occurred_at,
          actor: %{id: ^host_global_id}
        }
      }
    }

    assert is_binary(end_event_id)
    _end_local_id = decode_global_node_id(end_event_id, :live_session_ended_event)
    assert is_binary(end_occurred_at)

    assert_receive %Phoenix.Socket.Message{
      topic: ^session_topic,
      event: "session:state",
      payload: %{
        session_state: %{
          status: :ended,
          visibility: :public,
          viewer_count: 0
        }
      }
    }

    assert_receive %Phoenix.Socket.Broadcast{
      topic: ^control_topic,
      event: "disconnect",
      payload: %{reason: "session_ended"}
    }

    assert_push "disconnect", %{reason: "session_ended"}

    assert_receive {:DOWN, ^monitor_ref, :process, _, _}
    assert :ok = wait_for_participant_left(session.id, viewer.id)
  end

  test "leaveLiveSession disconnects the caller's joined channel" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    monitor_ref = Process.monitor(socket.channel_pid)

    session_id = Absinthe.Relay.Node.to_global_id(:live_session, session.id, LCGQL.Schema)
    context = %{current_scope: Accounts.scope_for_user(viewer)}
    control_topic = LiveSessionTopics.session_user_control_topic(session.id, viewer.id)
    :ok = Phoenix.PubSub.subscribe(LC.PubSub, control_topic)

    mutation = """
    mutation LeaveLiveSession($liveSessionId: ID!) {
      leaveLiveSession(input: {liveSessionId: $liveSessionId}) {
        left
        errors {
          message
        }
      }
    }
    """

    assert {:ok,
            %{
              data: %{
                "leaveLiveSession" => %{
                  "left" => true,
                  "errors" => []
                }
              }
            }} =
             Absinthe.run(
               mutation,
               LCGQL.Schema,
               context: context,
               variables: %{"liveSessionId" => session_id}
             )

    assert_receive %Phoenix.Socket.Broadcast{
      topic: ^control_topic,
      event: "disconnect",
      payload: %{reason: "viewer_left"}
    }

    assert_push "disconnect", %{reason: "viewer_left"}

    assert_receive {:DOWN, ^monitor_ref, :process, _, _}
    assert :ok = wait_for_participant_left(session.id, viewer.id)
  end

  test "remote shard handoff keeps join client-safe during reconnect windows" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, runtime_pid} = Live.lookup_session_server(session.id)
    assert Process.alive?(runtime_pid)

    remote_owner = "remote-handoff@127.0.0.1"
    put_remote_owner(session, remote_owner)

    assert {:error, %{reason: "session_unavailable"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               LiveSessionTopics.live_session_topic(session.id)
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :remote_unreachable,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  defp socket_for(user) do
    socket(UserSocket, "user_socket:#{user.id}", %{current_user: user})
  end

  defp connected_socket_for(user, params) when is_map(params) do
    token = Accounts.generate_user_session_token(user)
    connect_params = Map.put(params, "token", token)

    case UserSocket.connect(
           connect_params,
           socket(UserSocket, "user_socket:#{user.id}", %{}),
           %{}
         ) do
      {:ok, socket} -> socket
      :error -> flunk("expected socket authentication to succeed")
    end
  end

  defp decode_global_node_id(global_id, expected_type) when is_binary(global_id) do
    assert {:ok, %{type: ^expected_type, id: local_id}} =
             Absinthe.Relay.Node.from_global_id(global_id, LCGQL.Schema)

    String.to_integer(local_id)
  end

  defp live_session_fixture(host_id) when is_integer(host_id) do
    Repo.insert!(%LiveSession{
      host_id: host_id,
      status: :live,
      visibility: :public
    })
  end

  defp wait_for_participant_left(session_id, user_id, attempts \\ 30)

  defp wait_for_participant_left(_session_id, _user_id, 0),
    do: flunk("participant row not marked left")

  defp wait_for_participant_left(session_id, user_id, attempts) do
    case Repo.get_by(LiveParticipant, live_session_id: session_id, user_id: user_id) do
      %LiveParticipant{left_at: %DateTime{}} ->
        :ok

      _other ->
        Process.sleep(10)
        wait_for_participant_left(session_id, user_id, attempts - 1)
    end
  end

  defp attach_live_channel_telemetry_handler do
    test_pid = self()
    handler_id = "live-channel-test-#{System.unique_integer([:positive, :monotonic])}"

    :ok =
      :telemetry.attach_many(
        handler_id,
        @live_channel_telemetry_events,
        &__MODULE__.handle_live_channel_telemetry_event/4,
        test_pid
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)
  end

  @spec handle_live_channel_telemetry_event([atom()], map(), map(), pid()) :: :ok
  def handle_live_channel_telemetry_event(event, measurements, metadata, test_pid)
      when is_list(event) and is_map(measurements) and is_map(metadata) and is_pid(test_pid) do
    send(test_pid, {:telemetry_event, event, measurements, metadata})
    :ok
  end

  defp put_remote_owner(%LiveSession{id: session_id}, remote_owner)
       when is_integer(session_id) and is_binary(remote_owner) do
    shard_id = RealtimeRuntime.shard_id(session_id)
    :ok = RealtimeRuntime.put_test_shard_owner(shard_id, {:remote, remote_owner})

    on_exit(fn ->
      RealtimeRuntime.clear_test_shard_owner(shard_id)
      RealtimeRuntime.stop_session_runtime(session_id)
    end)

    :ok
  end

  defp remove_message_mutation do
    """
    mutation($chatMessageEventId: ID!) {
      removeLiveChatMessageEvent(input: { chatMessageEventId: $chatMessageEventId }) {
        removedTimelineEventId
        errors {
          field
          message
        }
      }
    }
    """
  end

  defp edit_message_mutation do
    """
    mutation($chatMessageEventId: ID!, $body: String!) {
      editLiveChatMessage(input: { chatMessageEventId: $chatMessageEventId, body: $body }) {
        chatMessageEvent {
          id
          body
          edited
          editCount
        }
        errors {
          field
          message
        }
      }
    }
    """
  end
end
