import { describe, expect, test } from 'bun:test';

import {
  canRequestHostGoLive,
  canRequestHostPreflightBackCleanup,
  canUseHostPreflightBackAction,
  createHostBroadcastSessionState,
  hostBroadcastPreflightCleanupLiveSessionId,
  hostBroadcastSessionReducer,
} from './hostBroadcastSession';

describe('hostBroadcastSessionReducer', () => {
  test('moves to creating when a start is requested', () => {
    expect(
      hostBroadcastSessionReducer(createHostBroadcastSessionState(), {
        type: 'start_requested',
      }),
    ).toEqual({
      liveSessionId: null,
      status: 'creating',
      viewerSafeErrorText: null,
    });
  });

  test('stores the Relay live session ID and moves to starting on start success', () => {
    const creating = hostBroadcastSessionReducer(
      createHostBroadcastSessionState(),
      {
        type: 'start_requested',
      },
    );

    expect(
      hostBroadcastSessionReducer(creating, {
        liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
        type: 'start_succeeded',
      }),
    ).toEqual({
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      status: 'starting',
      viewerSafeErrorText: null,
    });
  });

  test('returns to idle with viewer-safe error text on start failure', () => {
    const creating = hostBroadcastSessionReducer(
      createHostBroadcastSessionState(),
      {
        type: 'start_requested',
      },
    );

    expect(
      hostBroadcastSessionReducer(creating, {
        type: 'start_failed',
        viewerSafeErrorText: 'We could not create this live session.',
      }),
    ).toEqual({
      liveSessionId: null,
      status: 'idle',
      viewerSafeErrorText: 'We could not create this live session.',
    });
  });

  test('blocks go-live until a live session exists and backend media is ready', () => {
    const starting = hostBroadcastSessionReducer(
      hostBroadcastSessionReducer(createHostBroadcastSessionState(), {
        type: 'start_requested',
      }),
      {
        liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
        type: 'start_succeeded',
      },
    );

    expect(canRequestHostGoLive(createHostBroadcastSessionState(), true)).toBe(
      false,
    );
    expect(canRequestHostGoLive(starting, false)).toBe(false);
    expect(canRequestHostGoLive(starting, true)).toBe(true);
  });

  test('tracks end request and clears session state on end success', () => {
    const starting = hostBroadcastSessionReducer(
      hostBroadcastSessionReducer(createHostBroadcastSessionState(), {
        type: 'start_requested',
      }),
      {
        liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
        type: 'start_succeeded',
      },
    );

    const ending = hostBroadcastSessionReducer(starting, {
      type: 'end_requested',
    });

    expect(ending).toEqual({
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      status: 'ending',
      viewerSafeErrorText: null,
    });

    expect(
      hostBroadcastSessionReducer(ending, {
        type: 'end_succeeded',
      }),
    ).toEqual({
      liveSessionId: null,
      status: 'ended',
      viewerSafeErrorText: null,
    });
  });

  test('returns to starting with viewer-safe error text on end failure', () => {
    const starting = hostBroadcastSessionReducer(
      hostBroadcastSessionReducer(createHostBroadcastSessionState(), {
        type: 'start_requested',
      }),
      {
        liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
        type: 'start_succeeded',
      },
    );

    const ending = hostBroadcastSessionReducer(starting, {
      type: 'end_requested',
    });

    expect(
      hostBroadcastSessionReducer(ending, {
        type: 'end_failed',
        viewerSafeErrorText: 'We could not end this live session.',
      }),
    ).toEqual({
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      status: 'starting',
      viewerSafeErrorText: 'We could not end this live session.',
    });
  });

  test('only requests back cleanup for a created starting session', () => {
    const idle = createHostBroadcastSessionState();
    const creating = hostBroadcastSessionReducer(idle, {
      type: 'start_requested',
    });
    const starting = hostBroadcastSessionReducer(creating, {
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      type: 'start_succeeded',
    });
    const ending = hostBroadcastSessionReducer(starting, {
      type: 'end_requested',
    });
    const ended = hostBroadcastSessionReducer(ending, {
      type: 'end_succeeded',
    });

    expect(canRequestHostPreflightBackCleanup(idle)).toBe(false);
    expect(canRequestHostPreflightBackCleanup(creating)).toBe(false);
    expect(canRequestHostPreflightBackCleanup(starting)).toBe(true);
    expect(canRequestHostPreflightBackCleanup(ending)).toBe(false);
    expect(canRequestHostPreflightBackCleanup(ended)).toBe(false);
  });

  test('returns cleanup target only for an abandoned starting preflight session', () => {
    const idle = createHostBroadcastSessionState();
    const creating = hostBroadcastSessionReducer(idle, {
      type: 'start_requested',
    });
    const starting = hostBroadcastSessionReducer(creating, {
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      type: 'start_succeeded',
    });
    const ending = hostBroadcastSessionReducer(starting, {
      type: 'end_requested',
    });
    const ended = hostBroadcastSessionReducer(ending, {
      type: 'end_succeeded',
    });

    expect(
      hostBroadcastPreflightCleanupLiveSessionId(starting, {
        hasEndLiveSessionRequestInFlight: false,
        hasGoLiveSucceeded: false,
      }),
    ).toBe('TGl2ZVNlc3Npb246MQ==');
    expect(
      hostBroadcastPreflightCleanupLiveSessionId(idle, {
        hasEndLiveSessionRequestInFlight: false,
        hasGoLiveSucceeded: false,
      }),
    ).toBeNull();
    expect(
      hostBroadcastPreflightCleanupLiveSessionId(creating, {
        hasEndLiveSessionRequestInFlight: false,
        hasGoLiveSucceeded: false,
      }),
    ).toBeNull();
    expect(
      hostBroadcastPreflightCleanupLiveSessionId(ending, {
        hasEndLiveSessionRequestInFlight: false,
        hasGoLiveSucceeded: false,
      }),
    ).toBeNull();
    expect(
      hostBroadcastPreflightCleanupLiveSessionId(ended, {
        hasEndLiveSessionRequestInFlight: false,
        hasGoLiveSucceeded: false,
      }),
    ).toBeNull();
    expect(
      hostBroadcastPreflightCleanupLiveSessionId(starting, {
        hasEndLiveSessionRequestInFlight: true,
        hasGoLiveSucceeded: false,
      }),
    ).toBeNull();
    expect(
      hostBroadcastPreflightCleanupLiveSessionId(starting, {
        hasEndLiveSessionRequestInFlight: false,
        hasGoLiveSucceeded: true,
      }),
    ).toBeNull();
  });

  test('blocks back action while lifecycle transitions can race cleanup', () => {
    const idle = createHostBroadcastSessionState();
    const creating = hostBroadcastSessionReducer(idle, {
      type: 'start_requested',
    });
    const starting = hostBroadcastSessionReducer(creating, {
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      type: 'start_succeeded',
    });
    const ending = hostBroadcastSessionReducer(starting, {
      type: 'end_requested',
    });
    const ended = hostBroadcastSessionReducer(ending, {
      type: 'end_succeeded',
    });

    expect(canUseHostPreflightBackAction(idle, false)).toBe(true);
    expect(canUseHostPreflightBackAction(creating, false)).toBe(false);
    expect(canUseHostPreflightBackAction(starting, false)).toBe(true);
    expect(canUseHostPreflightBackAction(ending, false)).toBe(false);
    expect(canUseHostPreflightBackAction(ended, false)).toBe(true);
    expect(canUseHostPreflightBackAction(starting, true)).toBe(false);
  });

  test('ignores stale lifecycle completions and duplicate requests', () => {
    const idle = createHostBroadcastSessionState();
    const creating = hostBroadcastSessionReducer(idle, {
      type: 'start_requested',
    });
    const starting = hostBroadcastSessionReducer(creating, {
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      type: 'start_succeeded',
    });

    expect(
      hostBroadcastSessionReducer(starting, {
        type: 'start_requested',
      }),
    ).toBe(starting);
    expect(
      hostBroadcastSessionReducer(starting, {
        liveSessionId: 'TGl2ZVNlc3Npb246Mg==',
        type: 'start_succeeded',
      }),
    ).toBe(starting);
    expect(
      hostBroadcastSessionReducer(starting, {
        type: 'start_failed',
        viewerSafeErrorText: 'This stale error should be ignored.',
      }),
    ).toBe(starting);
    expect(
      hostBroadcastSessionReducer(idle, {
        type: 'end_succeeded',
      }),
    ).toBe(idle);
    expect(
      hostBroadcastSessionReducer(idle, {
        type: 'end_failed',
        viewerSafeErrorText: 'This stale error should be ignored.',
      }),
    ).toBe(idle);

    const ending = hostBroadcastSessionReducer(starting, {
      type: 'end_requested',
    });

    expect(
      hostBroadcastSessionReducer(ending, {
        type: 'start_requested',
      }),
    ).toBe(ending);
  });
});
