import { describe, expect, test } from 'bun:test';

import {
  canRequestHostGoLive,
  createHostBroadcastSessionState,
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
