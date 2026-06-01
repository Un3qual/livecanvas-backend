import { describe, expect, test } from 'bun:test';

import {
  createLiveSessionWatchState,
  liveSessionWatchReducer,
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
});
