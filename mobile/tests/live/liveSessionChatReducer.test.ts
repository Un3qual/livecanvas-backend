import { describe, expect, test } from 'bun:test';

import {
  canStartLiveSessionChatSend,
  createLiveSessionChatState,
  liveSessionChatReducer,
  selectLiveSessionChatPaginationCursors,
  selectLiveSessionChatVisibleRows,
} from '../../src/live/liveSessionChatReducer';
import {
  createLiveSessionChatState as createLiveSessionChatStateFromStateModule,
} from '../../src/live/chat/liveSessionChatState';
import {
  canStartLiveSessionChatSend as canStartLiveSessionChatSendFromSelectorsModule,
  selectLiveSessionChatVisibleRows as selectLiveSessionChatVisibleRowsFromSelectorsModule,
} from '../../src/live/chat/liveSessionChatSelectors';
import {
  appendRows as appendChatRows,
  mergeRealtimeEvent as mergeChatRealtimeEvent,
} from '../../src/live/chat/liveSessionChatTimelineMerge';
import type {
  LiveSessionTimelineHistory,
  LiveSessionTimelineHistoryPageInfo,
  LiveSessionTimelineHistoryRow,
} from '../../src/live/liveSessionTimelineHistory';
import type { LiveSessionRealtimeEvent } from '../../src/live/liveSessionRealtimeEvents';

describe('liveSessionChatReducer', () => {
  test('chat modules expose derived selectors and merge helpers behind the public reducer shim', () => {
    expect(createLiveSessionChatStateFromStateModule()).toEqual(
      createLiveSessionChatState(),
    );

    const active = activeState('session-1');
    const appended = appendChatRows(active, [chatRow('event-1', 'retained')]);
    const merged = {
      ...active,
      ...appended,
    };
    const withRealtime = mergeChatRealtimeEvent(
      merged,
      realtimeTimelineEvent('event-2', 'live message'),
    );

    expect(
      selectLiveSessionChatVisibleRowsFromSelectorsModule(withRealtime).map(
        (row) => row.id,
      ),
    ).toEqual(['event-1', 'event-2']);
    expect(
      selectLiveSessionChatVisibleRows(withRealtime).map((row) => row.id),
    ).toEqual(['event-1', 'event-2']);
    expect(
      canStartLiveSessionChatSendFromSelectorsModule({
        channelStatus: 'joined',
        hasPendingSend: false,
        sendStatus: 'idle',
      }),
    ).toBe(true);
  });

  test('session change resets state to the active session', () => {
    const loaded = liveSessionChatReducer(
      liveSessionChatReducer(createLiveSessionChatState(), {
        sessionId: 'session-1',
        type: 'session_changed',
      }),
      {
        history: history([chatRow('event-1', 'hello')], pageInfo('c1', 'c1')),
        sessionId: 'session-1',
        type: 'retained_initial_loaded',
      },
    );

    const reset = liveSessionChatReducer(loaded, {
      sessionId: 'session-2',
      type: 'session_changed',
    });

    expect(reset).toEqual({
      activeSessionId: 'session-2',
      eventIds: [],
      eventsById: {},
      pageInfo: null,
    });
    expect(selectLiveSessionChatVisibleRows(reset)).toEqual([]);
  });

  test('retained initial page loads newest retained events in source order', () => {
    const page = pageInfo('cursor-1', 'cursor-2', {
      hasPreviousPage: true,
    });

    const state = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [lifecycleRow('event-1', 'LiveSessionStartedEvent'), chatRow('event-2', 'newest')],
        page,
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    expect(state.eventIds).toEqual(['event-1', 'event-2']);
    expect(Object.keys(state.eventsById)).toEqual(['event-1', 'event-2']);
    expect(selectLiveSessionChatVisibleRows(state).map((row) => row.id)).toEqual(
      ['event-1', 'event-2'],
    );
    expect(state.pageInfo).toBe(page);
    expect(selectLiveSessionChatPaginationCursors(state)).toEqual({
      endCursor: 'cursor-2',
      startCursor: 'cursor-1',
    });
  });

  test('retained initial refresh preserves realtime rows already merged into chat', () => {
    const retained = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [
          chatRow('event-1', 'retained'),
          chatRow('event-2', 'retained before live'),
        ],
        pageInfo('cursor-1', 'cursor-2'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });
    const withRealtime = liveSessionChatReducer(retained, {
      event: realtimeTimelineEvent('event-3', 'live message'),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    const refreshed = liveSessionChatReducer(withRealtime, {
      history: history(
        [
          chatRow('event-1', 'retained refreshed'),
          chatRow('event-2', 'retained refreshed before live'),
        ],
        pageInfo('cursor-1-refresh', 'cursor-2-refresh'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    expect(refreshed.eventIds).toEqual(['event-1', 'event-2', 'event-3']);
    expect(selectLiveSessionChatVisibleRows(refreshed).map((row) => row.id)).toEqual(
      ['event-1', 'event-2', 'event-3'],
    );
    expect(selectLiveSessionChatVisibleRows(refreshed)[0]).toMatchObject({
      body: 'retained refreshed',
      cursor: 'cursor-event-1',
      id: 'event-1',
    });
    expect(selectLiveSessionChatVisibleRows(refreshed)[2]).toMatchObject({
      body: 'live message',
      cursor: null,
      id: 'event-3',
    });
    expect(refreshed.pageInfo).toEqual(
      pageInfo('cursor-1-refresh', 'cursor-2-refresh'),
    );
  });

  test('retained initial refresh inserts older rows before overlapping realtime rows', () => {
    const withFirstRealtime = liveSessionChatReducer(activeState('session-1'), {
      event: realtimeTimelineEvent('event-101', 'live message 101'),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });
    const withRealtime = liveSessionChatReducer(withFirstRealtime, {
      event: realtimeTimelineEvent('event-102', 'live message 102'),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    const refreshed = liveSessionChatReducer(withRealtime, {
      history: history(
        [
          chatRow('event-71', 'older retained'),
          chatRow('event-101', 'retained live message 101'),
          chatRow('event-102', 'retained live message 102'),
          chatRow('event-103', 'missed newer retained'),
        ],
        pageInfo('cursor-event-71', 'cursor-event-103'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    expect(refreshed.eventIds).toEqual([
      'event-71',
      'event-101',
      'event-102',
      'event-103',
    ]);
    expect(selectLiveSessionChatVisibleRows(refreshed).map((row) => row.id)).toEqual(
      ['event-71', 'event-101', 'event-102', 'event-103'],
    );
    expect(refreshed.eventsById['event-101']?.cursor).toBe('cursor-event-101');
  });

  test('retained initial refresh interleaves no-overlap rows by occurrence time', () => {
    const withFirstRealtime = liveSessionChatReducer(activeState('session-1'), {
      event: realtimeTimelineEventAt(
        'event-r1',
        'live message 10:00',
        '2026-06-04T10:00:00.000000Z',
      ),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });
    const withRealtime = liveSessionChatReducer(withFirstRealtime, {
      event: realtimeTimelineEventAt(
        'event-r2',
        'live message 11:00',
        '2026-06-04T11:00:00.000000Z',
      ),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    const refreshed = liveSessionChatReducer(withRealtime, {
      history: history(
        [
          chatRowAt('event-a', 'retained 09:00', '2026-06-04T09:00:00.000000Z'),
          chatRowAt('event-b', 'retained 10:30', '2026-06-04T10:30:00.000000Z'),
        ],
        pageInfo('cursor-event-a', 'cursor-event-b'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    expect(refreshed.eventIds).toEqual([
      'event-a',
      'event-r1',
      'event-b',
      'event-r2',
    ]);
    expect(selectLiveSessionChatVisibleRows(refreshed).map((row) => row.id)).toEqual(
      ['event-a', 'event-r1', 'event-b', 'event-r2'],
    );
  });

  test('retained initial refresh deduplicates incoming overlap before sorting', () => {
    const withRealtime = liveSessionChatReducer(
      liveSessionChatReducer(activeState('session-1'), {
        event: realtimeTimelineEventAt(
          'event-r1',
          'live message 10:00',
          '2026-06-04T10:00:00.000000Z',
        ),
        sessionId: 'session-1',
        type: 'realtime_event_received',
      }),
      {
        event: realtimeTimelineEventAt(
          'event-r2',
          'live message 11:00',
          '2026-06-04T11:00:00.000000Z',
        ),
        sessionId: 'session-1',
        type: 'realtime_event_received',
      },
    );

    const refreshed = liveSessionChatReducer(withRealtime, {
      history: history(
        [
          chatRowAt(
            'event-a',
            'retained 09:00',
            '2026-06-04T09:00:00.000000Z',
          ),
          chatRowAt(
            'event-r1',
            'retained overlap 10:00',
            '2026-06-04T10:00:00.000000Z',
          ),
          chatRowAt(
            'event-r1',
            'retained duplicate 10:00',
            '2026-06-04T10:00:00.000000Z',
          ),
          chatRowAt(
            'event-b',
            'retained 10:30',
            '2026-06-04T10:30:00.000000Z',
          ),
        ],
        pageInfo('cursor-event-a', 'cursor-event-b'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    expect(refreshed.eventIds).toEqual([
      'event-a',
      'event-r1',
      'event-b',
      'event-r2',
    ]);
    expect(refreshed.eventsById['event-r1']).toMatchObject({
      body: 'retained duplicate 10:00',
      cursor: 'cursor-event-r1',
      id: 'event-r1',
    });
  });

  test('retained initial refresh preserves loaded older-page cursors', () => {
    const initial = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [chatRow('event-3', 'third'), chatRow('event-4', 'fourth')],
        pageInfo('cursor-event-3', 'cursor-event-4', { hasPreviousPage: true }),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });
    const withOlder = liveSessionChatReducer(initial, {
      history: history(
        [
          chatRow('event-1', 'first'),
          chatRow('event-2', 'second'),
          chatRow('event-3', 'third overlap'),
        ],
        pageInfo('cursor-event-1', 'cursor-event-3', { hasPreviousPage: false }),
      ),
      sessionId: 'session-1',
      type: 'retained_older_loaded',
    });

    const refreshed = liveSessionChatReducer(withOlder, {
      history: history(
        [
          chatRow('event-3', 'third refreshed'),
          chatRow('event-4', 'fourth refreshed'),
          chatRow('event-5', 'fifth'),
        ],
        pageInfo('cursor-event-3-refresh', 'cursor-event-5', {
          hasPreviousPage: true,
        }),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    expect(refreshed.eventIds).toEqual([
      'event-1',
      'event-2',
      'event-3',
      'event-4',
      'event-5',
    ]);
    expect(refreshed.pageInfo).toEqual({
      endCursor: 'cursor-event-5',
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: 'cursor-event-1',
    });
  });

  test('older retained page prepends rows without duplicate IDs', () => {
    const initial = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [chatRow('event-2', 'already loaded'), chatRow('event-3', 'latest')],
        pageInfo('cursor-2', 'cursor-3', { hasPreviousPage: true }),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    const withOlder = liveSessionChatReducer(initial, {
      history: history(
        [chatRow('event-1', 'older'), chatRow('event-2', 'overlap')],
        pageInfo('cursor-1', 'cursor-2', { hasPreviousPage: false }),
      ),
      sessionId: 'session-1',
      type: 'retained_older_loaded',
    });

    expect(withOlder.eventIds).toEqual(['event-1', 'event-2', 'event-3']);
    expect(selectLiveSessionChatVisibleRows(withOlder).map((row) => row.id)).toEqual(
      ['event-1', 'event-2', 'event-3'],
    );
    expect(withOlder.pageInfo).toEqual({
      endCursor: 'cursor-3',
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: 'cursor-1',
    });
  });

  test('newer retained catch-up appends rows without duplicate IDs', () => {
    const initial = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [chatRow('event-1', 'first'), chatRow('event-2', 'already loaded')],
        pageInfo('cursor-1', 'cursor-2', { hasNextPage: true }),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    const withNewer = liveSessionChatReducer(initial, {
      history: history(
        [chatRow('event-2', 'overlap'), chatRow('event-3', 'caught up')],
        pageInfo('cursor-2', 'cursor-3', { hasNextPage: false }),
      ),
      sessionId: 'session-1',
      type: 'retained_newer_loaded',
    });

    expect(withNewer.eventIds).toEqual(['event-1', 'event-2', 'event-3']);
    expect(selectLiveSessionChatVisibleRows(withNewer).map((row) => row.id)).toEqual(
      ['event-1', 'event-2', 'event-3'],
    );
    expect(withNewer.pageInfo).toEqual({
      endCursor: 'cursor-3',
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: 'cursor-1',
    });
  });

  test('realtime timeline event appends new rows and replaces existing IDs', () => {
    const initial = liveSessionChatReducer(activeState('session-1'), {
      history: history([chatRow('event-1', 'retained')], pageInfo('cursor-1', 'cursor-1')),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    const appended = liveSessionChatReducer(initial, {
      event: realtimeTimelineEvent('event-2', 'live message'),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    expect(appended.eventIds).toEqual(['event-1', 'event-2']);
    expect(selectLiveSessionChatVisibleRows(appended)[1]).toEqual({
      __typename: 'ChatMessageEvent',
      actor: { id: 'actor-event-2' },
      body: 'live message',
      cursor: null,
      editCount: 0,
      edited: false,
      editedAt: null,
      eventType: 'chat_message_sent',
      id: 'event-2',
      kind: 'chat_message',
      occurredAt: '2026-06-04T18:00:00.000000Z',
    });

    const replaced = liveSessionChatReducer(appended, {
      event: realtimeTimelineEvent('event-2', 'live message replay'),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    expect(replaced.eventIds).toEqual(['event-1', 'event-2']);
    expect(selectLiveSessionChatVisibleRows(replaced)[1]).toMatchObject({
      body: 'live message replay',
      id: 'event-2',
    });
  });

  test('realtime timeline event updates replace rows without changing order', () => {
    const initial = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [chatRow('event-1', 'first'), chatRow('event-2', 'second')],
        pageInfo('cursor-1', 'cursor-2'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    const updated = liveSessionChatReducer(initial, {
      event: realtimeTimelineEventUpdated('event-1', 'first edited'),
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    expect(updated.eventIds).toEqual(['event-1', 'event-2']);
    expect(selectLiveSessionChatVisibleRows(updated).map((row) => row.id)).toEqual(
      ['event-1', 'event-2'],
    );
    expect(selectLiveSessionChatVisibleRows(updated)[0]).toMatchObject({
      body: 'first edited',
      cursor: 'cursor-event-1',
      editCount: 1,
      edited: true,
      editedAt: '2026-06-04T18:01:00.000000Z',
      eventType: 'chat_message_edited',
      id: 'event-1',
    });
  });

  test('realtime timeline event removal deletes rows by opaque ID', () => {
    const initial = liveSessionChatReducer(activeState('session-1'), {
      history: history(
        [chatRow('event-1', 'first'), chatRow('event-2', 'second')],
        pageInfo('cursor-1', 'cursor-2'),
      ),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    const removed = liveSessionChatReducer(initial, {
      event: {
        kind: 'timeline_event_removed',
        removedTimelineEventId: 'event-1',
      },
      sessionId: 'session-1',
      type: 'realtime_event_received',
    });

    expect(removed.eventIds).toEqual(['event-2']);
    expect(selectLiveSessionChatVisibleRows(removed).map((row) => row.id)).toEqual([
      'event-2',
    ]);
    expect(removed.eventsById).not.toHaveProperty('event-1');
  });

  test('stale session actions are ignored', () => {
    const active = liveSessionChatReducer(activeState('session-1'), {
      history: history([chatRow('event-1', 'active')], pageInfo('cursor-1', 'cursor-1')),
      sessionId: 'session-1',
      type: 'retained_initial_loaded',
    });

    for (const action of [
      {
        history: history([chatRow('event-2', 'stale')], pageInfo('cursor-2', 'cursor-2')),
        sessionId: 'session-2',
        type: 'retained_initial_loaded' as const,
      },
      {
        event: realtimeTimelineEvent('event-3', 'stale realtime'),
        sessionId: 'session-2',
        type: 'realtime_event_received' as const,
      },
    ]) {
      expect(liveSessionChatReducer(active, action)).toBe(active);
    }
  });

  test('chat send start decision closes same-render pending sends', () => {
    expect(
      canStartLiveSessionChatSend({
        channelStatus: 'joined',
        hasPendingSend: false,
        sendStatus: 'idle',
      }),
    ).toBe(true);

    expect(
      canStartLiveSessionChatSend({
        channelStatus: 'joined',
        hasPendingSend: true,
        sendStatus: 'idle',
      }),
    ).toBe(false);

    expect(
      canStartLiveSessionChatSend({
        channelStatus: 'joined',
        hasPendingSend: false,
        sendStatus: 'sending',
      }),
    ).toBe(false);

    expect(
      canStartLiveSessionChatSend({
        channelStatus: 'closed',
        hasPendingSend: false,
        sendStatus: 'idle',
      }),
    ).toBe(false);
  });
});

function activeState(sessionId: string) {
  return liveSessionChatReducer(createLiveSessionChatState(), {
    sessionId,
    type: 'session_changed',
  });
}

function history(
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
  pageInfo: LiveSessionTimelineHistoryPageInfo | null,
): LiveSessionTimelineHistory {
  return { pageInfo, rows };
}

function pageInfo(
  startCursor: string,
  endCursor: string,
  overrides: Partial<LiveSessionTimelineHistoryPageInfo> = {},
): LiveSessionTimelineHistoryPageInfo {
  return {
    endCursor,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor,
    ...overrides,
  };
}

function chatRow(
  id: string,
  body: string,
): LiveSessionTimelineHistoryRow {
  return chatRowAt(id, body, '2026-06-04T17:00:00.000000Z');
}

function chatRowAt(
  id: string,
  body: string,
  occurredAt: string,
): LiveSessionTimelineHistoryRow {
  return {
    __typename: 'ChatMessageEvent',
    actor: { id: `actor-${id}` },
    body,
    cursor: `cursor-${id}`,
    editCount: 0,
    edited: false,
    editedAt: null,
    eventType: 'CHAT_MESSAGE_SENT',
    id,
    kind: 'chat_message',
    occurredAt,
  };
}

function lifecycleRow(
  id: string,
  typename: 'LiveSessionEndedEvent' | 'LiveSessionStartedEvent',
): LiveSessionTimelineHistoryRow {
  return {
    __typename: typename,
    actor: null,
    cursor: `cursor-${id}`,
    eventType:
      typename === 'LiveSessionStartedEvent'
        ? 'LIVE_SESSION_STARTED'
        : 'LIVE_SESSION_ENDED',
    id,
    kind: 'lifecycle',
    label: typename === 'LiveSessionStartedEvent' ? 'Live started' : 'Live ended',
    occurredAt: '2026-06-04T17:00:00.000000Z',
  };
}

function realtimeTimelineEvent(
  id: string,
  body: string,
): LiveSessionRealtimeEvent {
  return realtimeTimelineEventAt(
    id,
    body,
    '2026-06-04T18:00:00.000000Z',
  );
}

function realtimeTimelineEventAt(
  id: string,
  body: string,
  occurredAt: string,
): LiveSessionRealtimeEvent {
  return {
    event: {
      __typename: 'ChatMessageEvent',
      actor: { id: `actor-${id}` },
      body,
      editCount: 0,
      edited: false,
      editedAt: null,
      eventType: 'chat_message_sent',
      id,
      occurredAt,
    },
    kind: 'timeline_event',
  };
}

function realtimeTimelineEventUpdated(
  id: string,
  body: string,
): LiveSessionRealtimeEvent {
  return {
    event: {
      __typename: 'ChatMessageEvent',
      actor: { id: `actor-${id}` },
      body,
      editCount: 1,
      edited: true,
      editedAt: '2026-06-04T18:01:00.000000Z',
      eventType: 'chat_message_edited',
      id,
      occurredAt: '2026-06-04T18:00:00.000000Z',
    },
    kind: 'timeline_event_updated',
  };
}
