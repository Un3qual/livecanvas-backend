import { describe, expect, test } from 'bun:test';

import { normalizeLiveSessionRealtimeEvent } from './liveSessionRealtimeEvents';

describe('liveSessionRealtimeEvents', () => {
  test('normalizes session state payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('session:state', {
        session_state: {
          status: 'live',
          visibility: 'public',
          viewer_count: 12,
        },
      }),
    ).toEqual({
      kind: 'session_state',
      status: 'LIVE',
      visibility: 'PUBLIC',
      viewerCount: 12,
    });
  });

  test('normalizes timeline event payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: null,
        },
      }),
    ).toEqual({
      kind: 'timeline_event',
      event: {
        __typename: 'ChatMessageEvent',
        id: 'event-id',
        eventType: 'chat_message_sent',
        body: 'hello',
        actor: { id: 'actor-id' },
        occurredAt: '2026-06-01T23:17:09Z',
        edited: false,
        editCount: 0,
        editedAt: null,
      },
    });
  });

  test('normalizes updated timeline event payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event_updated', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'updated-event-id',
          event_type: 'chat_message_edited',
          body: 'updated',
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:19:09Z',
          edited: true,
          edit_count: 1,
          edited_at: '2026-06-01T23:20:09Z',
        },
      }),
    ).toEqual({
      kind: 'timeline_event_updated',
      event: {
        __typename: 'ChatMessageEvent',
        id: 'updated-event-id',
        eventType: 'chat_message_edited',
        body: 'updated',
        actor: { id: 'actor-id' },
        occurredAt: '2026-06-01T23:19:09Z',
        edited: true,
        editCount: 1,
        editedAt: '2026-06-01T23:20:09Z',
      },
    });
  });

  test('normalizes removed timeline event payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event_removed', {
        removed_timeline_event_id: 'event-id',
      }),
    ).toEqual({
      kind: 'timeline_event_removed',
      removedTimelineEventId: 'event-id',
    });
  });

  test('normalizes media offer and answer broadcasts', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('media:offer', {
        sender_role: 'host',
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      }),
    ).toEqual({
      description: {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
      kind: 'media_offer',
      senderRole: 'host',
    });
    expect(
      normalizeLiveSessionRealtimeEvent('media:answer', {
        sender_role: 'viewer',
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      }),
    ).toEqual({
      description: {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
      kind: 'media_answer',
      senderRole: 'viewer',
    });
  });

  test('normalizes media ICE candidate broadcasts', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('media:ice_candidate', {
        candidate: 'candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx',
        sdp_m_line_index: 0,
        sdp_mid: '0',
        sender_role: 'host',
        username_fragment: 'ufrag',
      }),
    ).toEqual({
      candidate: {
        candidate:
          'candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'ufrag',
      },
      kind: 'media_ice_candidate',
      senderRole: 'host',
    });
  });

  test('normalizes viewer media readiness broadcasts', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('media:viewer_ready', {
        sender_role: 'viewer',
      }),
    ).toEqual({
      kind: 'media_viewer_ready',
      senderRole: 'viewer',
    });
  });

  test('accepts lifecycle timeline events with nullable chat fields', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'LiveSessionStartedEvent',
          id: 'started-event-id',
          event_type: 'live_session_started',
          body: null,
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:18:09Z',
          edited: null,
          edit_count: null,
          edited_at: null,
        },
      }),
    ).toEqual({
      kind: 'timeline_event',
      event: {
        __typename: 'LiveSessionStartedEvent',
        id: 'started-event-id',
        eventType: 'live_session_started',
        body: null,
        actor: { id: 'actor-id' },
        occurredAt: '2026-06-01T23:18:09Z',
        edited: null,
        editCount: null,
        editedAt: null,
      },
    });
  });

  test('accepts lifecycle timeline events without an actor', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'LiveSessionEndedEvent',
          id: 'ended-event-id',
          event_type: 'live_session_ended',
          body: null,
          actor: null,
          occurred_at: '2026-06-01T23:21:09Z',
          edited: null,
          edit_count: null,
          edited_at: null,
        },
      }),
    ).toEqual({
      kind: 'timeline_event',
      event: {
        __typename: 'LiveSessionEndedEvent',
        id: 'ended-event-id',
        eventType: 'live_session_ended',
        body: null,
        actor: null,
        occurredAt: '2026-06-01T23:21:09Z',
        edited: null,
        editCount: null,
        editedAt: null,
      },
    });
  });

  test('ignores malformed or unknown payloads', () => {
    expect(normalizeLiveSessionRealtimeEvent('session:state', {})).toBeNull();
    expect(normalizeLiveSessionRealtimeEvent('session:state', [])).toBeNull();
    expect(normalizeLiveSessionRealtimeEvent('timeline:event', null)).toBeNull();
    expect(normalizeLiveSessionRealtimeEvent('unknown:event', {})).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('media:offer', {
        sender_role: 'host',
        sdp: 'v=0\r\nwrong-type',
        type: 'answer',
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('media:ice_candidate', {
        candidate: 'candidate',
        sender_role: 'publisher',
      }),
    ).toBeNull();
  });

  test('rejects blank opaque ids', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: '   ',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: null,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event_removed', {
        removed_timeline_event_id: '   ',
      }),
    ).toBeNull();
  });

  test('rejects invalid numeric values', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('session:state', {
        session_state: {
          status: 'live',
          visibility: 'public',
          viewer_count: Number.POSITIVE_INFINITY,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('session:state', {
        session_state: {
          status: 'live',
          visibility: 'public',
          viewer_count: -1,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('session:state', {
        session_state: {
          status: 'live',
          visibility: 'public',
          viewer_count: 1.5,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor: { id: '   ' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: null,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: Number.NaN,
          edited_at: null,
        },
      }),
    ).toBeNull();
  });

  test('rejects invalid nullable chat fields', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: {},
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: null,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: 'false',
          edit_count: 0,
          edited_at: null,
        },
      }),
    ).toBeNull();
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor: { id: 'actor-id' },
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: 123,
        },
      }),
    ).toBeNull();
  });
});
