import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  canRequestLiveSessionWatchCommand,
  liveSessionWatchMachine,
  readLiveSessionWatchError,
  readLiveSessionWatchPendingCommand,
  readLiveSessionWatchSubmission,
  shouldAutoLeaveLiveSession,
  isLiveSessionViewerJoined,
  isLiveSessionWatchMutationPending,
} from '../../src/live/watch/state/liveSessionWatchMachine';

function startMachine() {
  return createActor(liveSessionWatchMachine).start();
}

describe('liveSessionWatchMachine', () => {
  test('tracks join request and success for the active session', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });

    let snapshot = actor.getSnapshot();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe(
      'joining',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toEqual({
      kind: 'join',
      sessionId: 'session-1',
    });
    expect(
      isLiveSessionWatchMutationPending(snapshot, 'session-1', 'join'),
    ).toBe(true);
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);

    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });

    snapshot = actor.getSnapshot();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(true);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(true);
  });

  test('formats join failures as viewer-safe errors', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({
      errors: [{ field: 'liveSessionId', message: 'not_authorized' }],
      sessionId: 'session-1',
      type: 'JOIN_FAILED',
    });

    const snapshot = actor.getSnapshot();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchError(snapshot, 'session-1')).toBe(
      'This live session is not available to your account.',
    );
    expect(readLiveSessionWatchError(snapshot, 'other-session')).toBeNull();
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
  });

  test('ignores stale join success and failure after the route session changes', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'old-session' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'old-session' });
    actor.send({ type: 'SESSION_CHANGED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'old-session' });
    actor.send({
      errors: [{ field: null, message: 'rate_limited' }],
      sessionId: 'old-session',
      type: 'JOIN_FAILED',
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchError(snapshot, 'new-session')).toBeNull();
    expect(readLiveSessionWatchError(snapshot, 'old-session')).toBeNull();
    expect(readLiveSessionWatchSubmission(snapshot, 'new-session')).toBe(
      'idle',
    );
    expect(isLiveSessionViewerJoined(snapshot, 'new-session')).toBe(false);
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('ignores stale idle join and end requests after the route session changes', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'old-session' });

    let snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchSubmission(snapshot, 'new-session')).toBe(
      'idle',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();

    actor.send({ type: 'END_REQUESTED', sessionId: 'old-session' });

    snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchSubmission(snapshot, 'new-session')).toBe(
      'idle',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('requires a route session before command requests are accepted', () => {
    const joinActor = startMachine();

    joinActor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });

    let snapshot = joinActor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBeNull();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
    expect(
      canRequestLiveSessionWatchCommand(snapshot, 'session-1', 'join'),
    ).toBe(false);

    const endActor = startMachine();

    endActor.send({ type: 'END_REQUESTED', sessionId: 'session-1' });

    snapshot = endActor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBeNull();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
    expect(
      canRequestLiveSessionWatchCommand(snapshot, 'session-1', 'end'),
    ).toBe(false);
  });

  test('clears joined state after leave succeeds', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'LEAVE_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'LEAVE_SUCCEEDED', sessionId: 'session-1' });

    const snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('keeps joined state and retry eligibility after leave fails', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'LEAVE_REQUESTED', sessionId: 'session-1' });
    actor.send({
      errors: [],
      sessionId: 'session-1',
      type: 'LEAVE_FAILED',
    });

    const snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(true);
    expect(readLiveSessionWatchError(snapshot, 'session-1')).toBe(
      'We could not update this live session. Check your connection and try again.',
    );
    expect(readLiveSessionWatchError(snapshot, 'other-session')).toBeNull();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(true);
    expect(
      canRequestLiveSessionWatchCommand(snapshot, 'session-1', 'leave'),
    ).toBe(true);
  });

  test('ignores stale leave success and failure after the route session changes', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'new-session' });
    actor.send({ type: 'LEAVE_REQUESTED', sessionId: 'new-session' });
    actor.send({ type: 'LEAVE_SUCCEEDED', sessionId: 'old-session' });
    actor.send({
      errors: [{ field: null, message: 'rate_limited' }],
      sessionId: 'old-session',
      type: 'LEAVE_FAILED',
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchError(snapshot, 'new-session')).toBeNull();
    expect(readLiveSessionWatchError(snapshot, 'old-session')).toBeNull();
    expect(isLiveSessionViewerJoined(snapshot, 'new-session')).toBe(true);
    expect(readLiveSessionWatchSubmission(snapshot, 'new-session')).toBe(
      'leaving',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toEqual({
      kind: 'leave',
      sessionId: 'new-session',
    });
  });

  test('clears joined state when channel membership is lost', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'MEMBERSHIP_LOST', sessionId: 'session-1' });

    const snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
  });

  test('ignores stale membership loss after the route session changes', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'new-session' });
    actor.send({ type: 'MEMBERSHIP_LOST', sessionId: 'old-session' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchError(snapshot, 'new-session')).toBeNull();
    expect(readLiveSessionWatchError(snapshot, 'old-session')).toBeNull();
    expect(isLiveSessionViewerJoined(snapshot, 'new-session')).toBe(true);
    expect(shouldAutoLeaveLiveSession(snapshot, 'new-session')).toBe(true);
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('tracks end request, success, and failure without pretending failed ends succeeded', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'END_REQUESTED', sessionId: 'session-1' });

    let snapshot = actor.getSnapshot();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe(
      'ending',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toEqual({
      kind: 'end',
      sessionId: 'session-1',
    });
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(true);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);

    actor.send({
      errors: [{ field: null, message: 'rate_limited' }],
      sessionId: 'session-1',
      type: 'END_FAILED',
    });

    snapshot = actor.getSnapshot();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(true);
    expect(readLiveSessionWatchError(snapshot, 'session-1')).toBe(
      'Too many live-session attempts. Wait a moment and try again.',
    );
    expect(readLiveSessionWatchError(snapshot, 'other-session')).toBeNull();
    expect(
      canRequestLiveSessionWatchCommand(snapshot, 'session-1', 'end'),
    ).toBe(true);

    actor.send({ type: 'END_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'END_SUCCEEDED', sessionId: 'session-1' });

    snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
  });

  test('keeps auto-leave retry eligibility after end fails while joined', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'END_REQUESTED', sessionId: 'session-1' });
    actor.send({
      errors: [],
      sessionId: 'session-1',
      type: 'END_FAILED',
    });

    const snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(true);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(true);
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('clears joined state when membership is lost during pending end', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'END_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'MEMBERSHIP_LOST', sessionId: 'session-1' });

    const snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe('idle');
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('ignores stale end success and failure after the route session changes', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'new-session' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'new-session' });
    actor.send({ type: 'END_REQUESTED', sessionId: 'new-session' });
    actor.send({ type: 'END_SUCCEEDED', sessionId: 'old-session' });
    actor.send({
      errors: [{ field: null, message: 'rate_limited' }],
      sessionId: 'old-session',
      type: 'END_FAILED',
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchError(snapshot, 'new-session')).toBeNull();
    expect(readLiveSessionWatchError(snapshot, 'old-session')).toBeNull();
    expect(isLiveSessionViewerJoined(snapshot, 'new-session')).toBe(true);
    expect(readLiveSessionWatchSubmission(snapshot, 'new-session')).toBe(
      'ending',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toEqual({
      kind: 'end',
      sessionId: 'new-session',
    });
  });

  test('clears joined state and disables auto-leave when the session ends', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });
    actor.send({ type: 'JOIN_SUCCEEDED', sessionId: 'session-1' });
    actor.send({ type: 'SESSION_ENDED', sessionId: 'session-1' });

    const snapshot = actor.getSnapshot();
    expect(isLiveSessionViewerJoined(snapshot, 'session-1')).toBe(false);
    expect(shouldAutoLeaveLiveSession(snapshot, 'session-1')).toBe(false);
    expect(readLiveSessionWatchPendingCommand(snapshot)).toBeNull();
  });

  test('ignores stale session ended events after the route session changes', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'new-session' });
    actor.send({ type: 'SESSION_ENDED', sessionId: 'old-session' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.activeSessionId).toBe('new-session');
    expect(readLiveSessionWatchSubmission(snapshot, 'new-session')).toBe(
      'idle',
    );
  });

  test('exposes the same-tick join guard immediately after join is requested', () => {
    const actor = startMachine();

    actor.send({ type: 'SESSION_CHANGED', sessionId: 'session-1' });
    expect(
      canRequestLiveSessionWatchCommand(
        actor.getSnapshot(),
        'session-1',
        'join',
      ),
    ).toBe(true);

    actor.send({ type: 'JOIN_REQUESTED', sessionId: 'session-1' });

    const snapshot = actor.getSnapshot();
    expect(readLiveSessionWatchSubmission(snapshot, 'session-1')).toBe(
      'joining',
    );
    expect(readLiveSessionWatchPendingCommand(snapshot)).toEqual({
      kind: 'join',
      sessionId: 'session-1',
    });
    expect(
      canRequestLiveSessionWatchCommand(snapshot, 'session-1', 'join'),
    ).toBe(false);
  });
});
