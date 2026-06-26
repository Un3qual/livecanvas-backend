import { describe, expect, test } from 'bun:test';

import {
  clearLiveSessionWatchPendingMutation,
  createLiveSessionWatchState,
  isLiveSessionWatchAnyMutationPending,
  isLiveSessionWatchMutationPending,
  liveSessionWatchReducer,
  readLiveSessionWatchSubmission,
  shouldAutoLeaveLiveSession,
} from './liveSessionWatchReducer';

describe('liveSessionWatchReducer', () => {
  test('tracks join submission and success', () => {
    const joining = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'session-1',
    });

    expect(joining).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'joining',
    });

    expect(
      liveSessionWatchReducer(joining, {
        type: 'join_succeeded',
        sessionId: 'session-1',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'idle',
    });
  });

  test('ignores stale join completions from an older session', () => {
    const state = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'new-session',
    });

    expect(
      liveSessionWatchReducer(state, {
        type: 'join_succeeded',
        sessionId: 'old-session',
      }),
    ).toBe(state);

    expect(
      liveSessionWatchReducer(state, {
        error: 'Stale error',
        sessionId: 'old-session',
        type: 'join_failed',
      }),
    ).toBe(state);
  });

  test('tracks leave success and clears joined state', () => {
    const joined = {
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'idle' as const,
    };

    const leaving = liveSessionWatchReducer(joined, {
      type: 'leave_started',
      sessionId: 'session-1',
    });

    expect(leaving.submission).toBe('leaving');

    expect(
      liveSessionWatchReducer(leaving, {
        type: 'leave_succeeded',
        sessionId: 'session-1',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'idle',
    });
  });

  test('clears joined state when channel membership is lost', () => {
    const joined = {
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'leaving' as const,
    };

    expect(
      liveSessionWatchReducer(joined, {
        sessionId: 'session-1',
        type: 'membership_lost',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'idle',
    });
  });

  test('ignores stale leave failure after channel membership is lost', () => {
    const joined = {
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'idle' as const,
    };

    const leaving = liveSessionWatchReducer(joined, {
      sessionId: 'session-1',
      type: 'leave_started',
    });
    const membershipLost = liveSessionWatchReducer(leaving, {
      sessionId: 'session-1',
      type: 'membership_lost',
    });

    expect(
      liveSessionWatchReducer(membershipLost, {
        error: 'We could not update this live session.',
        sessionId: 'session-1',
        type: 'leave_failed',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'idle',
    });
  });

  test('ignores stale channel membership loss from an older session', () => {
    const joined = {
      activeSessionId: 'new-session',
      error: null,
      isJoined: true,
      submission: 'idle' as const,
    };

    expect(
      liveSessionWatchReducer(joined, {
        sessionId: 'old-session',
        type: 'membership_lost',
      }),
    ).toBe(joined);
  });

  test('tracks host end success and failure without requiring viewer join state', () => {
    const idle = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'session_changed',
      sessionId: 'session-1',
    });
    const ending = liveSessionWatchReducer(idle, {
      type: 'end_started',
      sessionId: 'session-1',
    });

    expect(ending).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'ending',
    });

    expect(
      liveSessionWatchReducer(ending, {
        type: 'end_succeeded',
        sessionId: 'session-1',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: null,
      isJoined: false,
      submission: 'idle',
    });

    expect(
      liveSessionWatchReducer(ending, {
        error: 'We could not update this live session.',
        sessionId: 'session-1',
        type: 'end_failed',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: 'We could not update this live session.',
      isJoined: false,
      submission: 'idle',
    });
  });

  test('stores viewer-safe mutation errors', () => {
    const joining = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'session-1',
    });

    expect(
      liveSessionWatchReducer(joining, {
        error: 'This live session is not available to your account.',
        sessionId: 'session-1',
        type: 'join_failed',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: 'This live session is not available to your account.',
      isJoined: false,
      submission: 'idle',
    });
  });

  test('resets watch state when the route session changes', () => {
    const leaving = {
      activeSessionId: 'session-1',
      error: 'Previous error',
      isJoined: true,
      submission: 'leaving' as const,
    };

    expect(
      liveSessionWatchReducer(leaving, {
        sessionId: 'session-2',
        type: 'session_changed',
      }),
    ).toEqual({
      activeSessionId: 'session-2',
      error: null,
      isJoined: false,
      submission: 'idle',
    });
  });

  test('leave failure keeps joined state so cleanup can be retried', () => {
    const leaving = {
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'leaving' as const,
    };

    expect(
      liveSessionWatchReducer(leaving, {
        error: 'We could not update this live session.',
        sessionId: 'session-1',
        type: 'leave_failed',
      }),
    ).toEqual({
      activeSessionId: 'session-1',
      error: 'We could not update this live session.',
      isJoined: true,
      submission: 'idle',
    });
  });

  test('ignores stale leave completions from an older session', () => {
    const leaving = {
      activeSessionId: 'new-session',
      error: null,
      isJoined: true,
      submission: 'leaving' as const,
    };

    expect(
      liveSessionWatchReducer(leaving, {
        sessionId: 'old-session',
        type: 'leave_succeeded',
      }),
    ).toBe(leaving);

    expect(
      liveSessionWatchReducer(leaving, {
        error: 'Stale error',
        sessionId: 'old-session',
        type: 'leave_failed',
      }),
    ).toBe(leaving);
  });

  test('scopes visible submission state to the active session', () => {
    const joining = liveSessionWatchReducer(createLiveSessionWatchState(), {
      type: 'join_started',
      sessionId: 'old-session',
    });

    expect(readLiveSessionWatchSubmission(joining, 'old-session')).toBe(
      'joining',
    );
    expect(readLiveSessionWatchSubmission(joining, 'new-session')).toBe('idle');
  });

  test('matches and clears pending mutations by session and kind', () => {
    const pending = { kind: 'join' as const, sessionId: 'session-1' };

    expect(
      isLiveSessionWatchMutationPending(pending, 'session-1', 'join'),
    ).toBe(true);
    expect(
      isLiveSessionWatchMutationPending(pending, 'session-1', 'leave'),
    ).toBe(false);
    expect(
      isLiveSessionWatchMutationPending(pending, 'session-1', 'end'),
    ).toBe(false);
    expect(
      isLiveSessionWatchMutationPending(pending, 'session-2', 'join'),
    ).toBe(false);
    expect(isLiveSessionWatchAnyMutationPending(pending, 'session-1')).toBe(
      true,
    );
    expect(isLiveSessionWatchAnyMutationPending(pending, 'session-2')).toBe(
      false,
    );

    expect(
      clearLiveSessionWatchPendingMutation(pending, 'session-2', 'join'),
    ).toBe(pending);
    expect(
      clearLiveSessionWatchPendingMutation(pending, 'session-1', 'leave'),
    ).toBe(pending);
    expect(
      clearLiveSessionWatchPendingMutation(pending, 'session-1', 'join'),
    ).toBeNull();
  });

  test('only auto-leaves an idle joined active session without pending work', () => {
    const joined = {
      activeSessionId: 'session-1',
      error: null,
      isJoined: true,
      submission: 'idle' as const,
    };

    expect(shouldAutoLeaveLiveSession(joined, 'session-1', null)).toBe(true);
    expect(shouldAutoLeaveLiveSession(joined, 'session-2', null)).toBe(false);
    expect(
      shouldAutoLeaveLiveSession(joined, 'session-1', {
        kind: 'leave',
        sessionId: 'session-1',
      }),
    ).toBe(false);
    expect(
      shouldAutoLeaveLiveSession(joined, 'session-1', {
        kind: 'end',
        sessionId: 'session-1',
      }),
    ).toBe(false);
    expect(
      shouldAutoLeaveLiveSession(
        { ...joined, submission: 'leaving' },
        'session-1',
        null,
      ),
    ).toBe(false);
  });
});
