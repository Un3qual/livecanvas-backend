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
          actor_id: 42,
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
        actorId: 42,
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
          actor_id: 42,
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
        actorId: 42,
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

  test('accepts lifecycle timeline events with nullable chat fields', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'LiveSessionStartedEvent',
          id: 'started-event-id',
          event_type: 'live_session_started',
          body: null,
          actor_id: 42,
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
        actorId: 42,
        occurredAt: '2026-06-01T23:18:09Z',
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
  });

  test('rejects blank opaque ids', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: '   ',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor_id: 42,
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
          actor_id: 0,
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
          actor_id: 42,
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
          actor_id: 42,
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
          actor_id: 42,
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
          actor_id: 42,
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: 123,
        },
      }),
    ).toBeNull();
  });
});
