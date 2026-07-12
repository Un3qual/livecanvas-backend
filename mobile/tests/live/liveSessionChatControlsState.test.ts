import { describe, expect, test } from 'bun:test';

import {
  canEditChatRow,
  canRemoveChatRow,
  createLiveSessionChatControlsState,
  liveSessionChatControlErrorMessage,
  liveSessionChatControlsReducer,
  type LiveSessionChatControlsAction,
  type LiveSessionChatControlsState,
} from '../../src/live/chat/liveSessionChatControlsState';
import type { LiveSessionTimelineHistoryRow } from '../../src/live/liveSessionTimelineHistory';

const authoredChatRow: LiveSessionTimelineHistoryRow = {
  __typename: 'ChatMessageEvent',
  actor: { id: 'viewer-1' },
  body: 'hello',
  cursor: 'cursor-1',
  editCount: 0,
  edited: false,
  editedAt: null,
  eventType: 'CHAT_MESSAGE_SENT',
  id: 'event-1',
  kind: 'chat_message',
  occurredAt: '2026-07-11T12:00:00.000000Z',
};

const otherChatRow: LiveSessionTimelineHistoryRow = {
  ...authoredChatRow,
  actor: { id: 'viewer-2' },
  id: 'event-2',
};

const startedRow: LiveSessionTimelineHistoryRow = {
  __typename: 'LiveSessionStartedEvent',
  actor: { id: 'viewer-1' },
  cursor: 'cursor-started',
  eventType: 'LIVE_SESSION_STARTED',
  id: 'event-started',
  kind: 'lifecycle',
  label: 'Live started',
  occurredAt: '2026-07-11T11:59:00.000000Z',
};

const endedRow: LiveSessionTimelineHistoryRow = {
  __typename: 'LiveSessionEndedEvent',
  actor: { id: 'viewer-1' },
  cursor: 'cursor-ended',
  eventType: 'LIVE_SESSION_ENDED',
  id: 'event-ended',
  kind: 'lifecycle',
  label: 'Live ended',
  occurredAt: '2026-07-11T13:00:00.000000Z',
};

function reduce(
  state: LiveSessionChatControlsState,
  action: LiveSessionChatControlsAction,
): LiveSessionChatControlsState {
  return liveSessionChatControlsReducer(state, action);
}

describe('live session chat control eligibility', () => {
  test('limits edit and remove to active chat rows with the correct relationship', () => {
    expect(
      canEditChatRow({
        row: authoredChatRow,
        sessionStatus: 'LIVE',
        viewerId: 'viewer-1',
      }),
    ).toBe(true);
    expect(
      canEditChatRow({
        row: otherChatRow,
        sessionStatus: 'LIVE',
        viewerId: 'viewer-1',
      }),
    ).toBe(false);
    expect(
      canRemoveChatRow({
        hostId: 'viewer-1',
        row: otherChatRow,
        sessionStatus: 'LIVE',
        viewerId: 'viewer-1',
      }),
    ).toBe(true);
    expect(
      canRemoveChatRow({
        hostId: 'viewer-1',
        row: otherChatRow,
        sessionStatus: 'LIVE',
        viewerId: 'viewer-2',
      }),
    ).toBe(false);
  });

  test('exposes neither action after session end or for actor-bearing lifecycle rows', () => {
    for (const row of [authoredChatRow, startedRow, endedRow]) {
      expect(
        canEditChatRow({
          row,
          sessionStatus: 'ENDED',
          viewerId: 'viewer-1',
        }),
      ).toBe(false);
      expect(
        canRemoveChatRow({
          hostId: 'viewer-1',
          row,
          sessionStatus: 'ENDED',
          viewerId: 'viewer-1',
        }),
      ).toBe(false);
    }

    for (const row of [startedRow, endedRow]) {
      expect(
        canEditChatRow({
          row,
          sessionStatus: 'LIVE',
          viewerId: 'viewer-1',
        }),
      ).toBe(false);
      expect(
        canRemoveChatRow({
          hostId: 'viewer-1',
          row,
          sessionStatus: 'LIVE',
          viewerId: 'viewer-1',
        }),
      ).toBe(false);
    }
  });
});

describe('liveSessionChatControlsReducer', () => {
  test('isolates pending operations by row and rejects every conflicting same-row start', () => {
    const initial = createLiveSessionChatControlsState();
    const editingFirst = reduce(initial, {
      action: 'edit',
      attemptId: 1,
      eventId: 'event-1',
      type: 'operation_started',
    });

    expect(editingFirst.pendingByEventId).toEqual({
      'event-1': { action: 'edit', attemptId: 1 },
    });
    expect(
      reduce(editingFirst, {
        action: 'edit',
        attemptId: 2,
        eventId: 'event-1',
        type: 'operation_started',
      }),
    ).toBe(editingFirst);
    expect(
      reduce(editingFirst, {
        action: 'remove',
        attemptId: 2,
        eventId: 'event-1',
        type: 'operation_started',
      }),
    ).toBe(editingFirst);

    expect(
      reduce(editingFirst, {
        action: 'remove',
        attemptId: 2,
        eventId: 'event-2',
        type: 'operation_started',
      }).pendingByEventId,
    ).toEqual({
      'event-1': { action: 'edit', attemptId: 1 },
      'event-2': { action: 'remove', attemptId: 2 },
    });
  });

  test('accepts only the current row attempt and allows a new action after settlement', () => {
    const editing = reduce(createLiveSessionChatControlsState(), {
      action: 'edit',
      attemptId: 4,
      eventId: 'event-1',
      type: 'operation_started',
    });

    expect(
      reduce(editing, {
        action: 'edit',
        attemptId: 3,
        eventId: 'event-1',
        message: 'stale',
        type: 'operation_failed',
      }),
    ).toBe(editing);

    const settled = reduce(editing, {
      action: 'edit',
      attemptId: 4,
      eventId: 'event-1',
      type: 'operation_succeeded',
    });
    expect(settled.pendingByEventId).toEqual({});

    const removing = reduce(settled, {
      action: 'remove',
      attemptId: 5,
      eventId: 'event-1',
      type: 'operation_started',
    });
    expect(removing.pendingByEventId['event-1']).toEqual({
      action: 'remove',
      attemptId: 5,
    });
  });

  test('tombstones removal success and ignores every late edit completion', () => {
    const removing = reduce(createLiveSessionChatControlsState(), {
      action: 'remove',
      attemptId: 8,
      eventId: 'event-1',
      type: 'operation_started',
    });
    const removed = reduce(removing, {
      action: 'remove',
      attemptId: 8,
      eventId: 'event-1',
      type: 'operation_succeeded',
    });

    expect(removed.removedEventIds).toEqual({ 'event-1': true });
    expect(removed.pendingByEventId).toEqual({});

    const lateActions: LiveSessionChatControlsAction[] = [
      {
        action: 'edit',
        attemptId: 7,
        eventId: 'event-1',
        type: 'operation_succeeded',
      },
      {
        action: 'edit',
        attemptId: 7,
        eventId: 'event-1',
        message: 'late failure',
        type: 'operation_failed',
      },
      {
        action: 'edit',
        attemptId: 9,
        eventId: 'event-1',
        type: 'operation_started',
      },
    ];

    for (const action of lateActions) {
      expect(reduce(removed, action)).toBe(removed);
    }
  });

  test('stores row-local failures and clears only the requested row', () => {
    let state = reduce(createLiveSessionChatControlsState(), {
      action: 'edit',
      attemptId: 1,
      eventId: 'event-1',
      type: 'operation_started',
    });
    state = reduce(state, {
      action: 'edit',
      attemptId: 1,
      eventId: 'event-1',
      message: 'Edit failed.',
      type: 'operation_failed',
    });
    state = reduce(state, {
      action: 'remove',
      attemptId: 2,
      eventId: 'event-2',
      type: 'operation_started',
    });
    state = reduce(state, {
      action: 'remove',
      attemptId: 2,
      eventId: 'event-2',
      message: 'Remove failed.',
      type: 'operation_failed',
    });

    expect(state.errorsByEventId).toEqual({
      'event-1': 'Edit failed.',
      'event-2': 'Remove failed.',
    });
    expect(state.failedActionByEventId).toEqual({
      'event-1': 'edit',
      'event-2': 'remove',
    });

    const cleared = reduce(state, {
      eventId: 'event-1',
      type: 'row_error_cleared',
    });
    expect(cleared.errorsByEventId).toEqual({
      'event-2': 'Remove failed.',
    });
    expect(cleared.failedActionByEventId).toEqual({
      'event-2': 'remove',
    });
  });
});

describe('liveSessionChatControlErrorMessage', () => {
  test('maps backend and transport failures to viewer-safe row copy', () => {
    expect(liveSessionChatControlErrorMessage('not_authorized')).toBe(
      'You cannot change this message.',
    );
    expect(liveSessionChatControlErrorMessage('session_ended')).toBe(
      'This live session has ended.',
    );
    expect(liveSessionChatControlErrorMessage('not_found')).toBe(
      'This message is no longer available. Refresh the chat.',
    );
    expect(liveSessionChatControlErrorMessage('is invalid')).toBe(
      'Check the message and try again.',
    );
    expect(liveSessionChatControlErrorMessage('unauthenticated')).toBe(
      'Sign in again to continue.',
    );
    expect(liveSessionChatControlErrorMessage(new Error('network down'))).toBe(
      'Could not update this message. Try again.',
    );
  });
});
