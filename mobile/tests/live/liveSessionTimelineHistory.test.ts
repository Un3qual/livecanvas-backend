import { describe, expect, test } from 'bun:test';

import { readLiveSessionTimelineHistory } from '../../src/live/liveSessionTimelineHistory';
import type { LiveSessionWatchScreenQuery } from '../../src/live/__generated__/LiveSessionWatchScreenQuery.graphql';

type LiveSessionWatchData = LiveSessionWatchScreenQuery['response'];
type LiveSessionNode = Extract<
  NonNullable<LiveSessionWatchData['node']>,
  { readonly __typename: 'LiveSession' }
>;

describe('readLiveSessionTimelineHistory', () => {
  test('reads nullable Relay timeline edges into chronological rows and preserves pageInfo', () => {
    const pageInfo = {
      endCursor: 'cursor-ended',
      hasNextPage: false,
      hasPreviousPage: true,
      startCursor: 'cursor-started',
    };

    const history = readLiveSessionTimelineHistory({
      edges: [
        null,
        {
          cursor: 'cursor-started',
          node: {
            __typename: 'LiveSessionStartedEvent',
            actor: { id: 'relay-user-id:host' },
            eventType: 'LIVE_SESSION_STARTED',
            id: 'relay-event-id:started/opaque',
            occurredAt: '2026-06-04T17:00:00.000000Z',
          },
        },
        {
          cursor: 'cursor-empty-node',
          node: null,
        },
        undefined,
        {
          cursor: 'cursor-chat',
          node: {
            __typename: 'ChatMessageEvent',
            actor: { id: 'relay-user-id:viewer' },
            body: 'The replay buffer caught this message.',
            editCount: 2,
            edited: true,
            editedAt: '2026-06-04T17:03:00.000000Z',
            eventType: 'CHAT_MESSAGE_SENT',
            id: 'relay-event-id:chat?opaque=true',
            occurredAt: '2026-06-04T17:02:00.000000Z',
          },
        },
        {
          cursor: 'cursor-ended',
          node: {
            __typename: 'LiveSessionEndedEvent',
            actor: null,
            eventType: 'LIVE_SESSION_ENDED',
            id: 'relay-event-id:ended#opaque',
            occurredAt: '2026-06-04T17:05:00.000000Z',
          },
        },
      ],
      pageInfo,
    });

    expect(history.pageInfo).toEqual(pageInfo);
    expect(history.rows.map((row) => row.cursor)).toEqual([
      'cursor-started',
      'cursor-chat',
      'cursor-ended',
    ]);
    expect(history.rows.map((row) => row.occurredAt)).toEqual([
      '2026-06-04T17:00:00.000000Z',
      '2026-06-04T17:02:00.000000Z',
      '2026-06-04T17:05:00.000000Z',
    ]);
    expect(history.rows).toEqual([
      {
        __typename: 'LiveSessionStartedEvent',
        actor: { id: 'relay-user-id:host' },
        cursor: 'cursor-started',
        eventType: 'LIVE_SESSION_STARTED',
        id: 'relay-event-id:started/opaque',
        kind: 'lifecycle',
        label: 'Live started',
        occurredAt: '2026-06-04T17:00:00.000000Z',
      },
      {
        __typename: 'ChatMessageEvent',
        actor: { id: 'relay-user-id:viewer' },
        body: 'The replay buffer caught this message.',
        cursor: 'cursor-chat',
        editCount: 2,
        edited: true,
        editedAt: '2026-06-04T17:03:00.000000Z',
        eventType: 'CHAT_MESSAGE_SENT',
        id: 'relay-event-id:chat?opaque=true',
        kind: 'chat_message',
        occurredAt: '2026-06-04T17:02:00.000000Z',
      },
      {
        __typename: 'LiveSessionEndedEvent',
        actor: null,
        cursor: 'cursor-ended',
        eventType: 'LIVE_SESSION_ENDED',
        id: 'relay-event-id:ended#opaque',
        kind: 'lifecycle',
        label: 'Live ended',
        occurredAt: '2026-06-04T17:05:00.000000Z',
      },
    ]);
    expect('body' in history.rows[0]).toBe(false);
    expect('body' in history.rows[2]).toBe(false);
  });

  test('keeps future timeline event typenames as generic system rows', () => {
    expect(
      readLiveSessionTimelineHistory({
        edges: [
          {
            cursor: 'cursor-future',
            node: {
              __typename: 'LiveSessionPinnedEvent',
              actor: null,
              eventType: 'LIVE_SESSION_PINNED',
              id: 'relay-event-id:future/opaque',
              occurredAt: '2026-06-04T17:08:00.000000Z',
            },
          },
        ],
        pageInfo: {
          endCursor: 'cursor-future',
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: 'cursor-future',
        },
      }).rows,
    ).toEqual([
      {
        __typename: 'LiveSessionPinnedEvent',
        actor: null,
        cursor: 'cursor-future',
        eventType: 'LIVE_SESSION_PINNED',
        id: 'relay-event-id:future/opaque',
        kind: 'unknown',
        label: 'Timeline event',
        occurredAt: '2026-06-04T17:08:00.000000Z',
      },
    ]);
  });

  test('accepts generated Relay timeline connections and normalizes undefined fields', () => {
    const relayConnection: NonNullable<LiveSessionNode['timelineEvents']> = {
      edges: [
        {
          cursor: undefined,
          node: {
            __typename: 'LiveSessionPinnedEvent',
            actor: undefined,
            eventType: 'CHAT_MESSAGE_SENT',
            id: 'relay-event-id:future/undefined-fields',
            occurredAt: '2026-06-04T17:09:00.000000Z',
          },
        },
      ],
      pageInfo: {
        endCursor: undefined,
        hasNextPage: false,
        hasPreviousPage: true,
        startCursor: undefined,
      },
    };

    expect(readLiveSessionTimelineHistory(relayConnection)).toEqual({
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: true,
        startCursor: null,
      },
      rows: [
        {
          __typename: 'LiveSessionPinnedEvent',
          actor: null,
          cursor: null,
          eventType: 'CHAT_MESSAGE_SENT',
          id: 'relay-event-id:future/undefined-fields',
          kind: 'unknown',
          label: 'Timeline event',
          occurredAt: '2026-06-04T17:09:00.000000Z',
        },
      ],
    });
  });

  test('rejects malformed chat message event rows without exporting undefined chat fields', () => {
    expect(
      readLiveSessionTimelineHistory({
        edges: [
          {
            cursor: 'cursor-malformed-chat',
            node: {
              __typename: 'ChatMessageEvent',
              actor: { id: 'relay-user-id:viewer' },
              eventType: 'CHAT_MESSAGE_SENT',
              id: 'relay-event-id:malformed-chat/opaque',
              occurredAt: '2026-06-04T17:10:00.000000Z',
            },
          },
        ],
        pageInfo: null,
      }).rows,
    ).toEqual([]);
  });

  test('returns an empty history when the connection is missing', () => {
    expect(readLiveSessionTimelineHistory(null)).toEqual({
      pageInfo: null,
      rows: [],
    });
    expect(readLiveSessionTimelineHistory()).toEqual({
      pageInfo: null,
      rows: [],
    });
  });
});
