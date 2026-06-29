import { describe, expect, test } from 'bun:test';

import {
  canUseLiveSessionChat,
  resolveRejectedLiveSessionChatSend,
} from '../../src/live/watch/liveSessionWatchChat';

describe('liveSessionWatchChat', () => {
  test('allows retained hosts to use chat without a viewer join', () => {
    expect(
      canUseLiveSessionChat({
        hasRetainedHostPublishingSession: false,
        isJoined: false,
      }),
    ).toBe(false);
    expect(
      canUseLiveSessionChat({
        hasRetainedHostPublishingSession: true,
        isJoined: false,
      }),
    ).toBe(true);
    expect(
      canUseLiveSessionChat({
        hasRetainedHostPublishingSession: false,
        isJoined: true,
      }),
    ).toBe(true);
  });

  test('turns active rejected chat sends into send failure events', () => {
    const sendToken = Symbol('send-token');

    expect(
      resolveRejectedLiveSessionChatSend({
        didUnmount: false,
        error: new Error('Socket closed'),
        liveSessionId: 'session-1',
        pendingSend: { sessionId: 'session-1', token: sendToken },
        sendToken,
      }),
    ).toEqual({
      failureEvent: {
        error: 'Socket closed',
        sessionId: 'session-1',
        type: 'SEND_FAILED',
      },
      nextPendingSend: null,
    });
  });

  test('preserves stale pending sends and suppresses unmounted failure events', () => {
    const activeToken = Symbol('active-token');
    const staleToken = Symbol('stale-token');
    const pendingSend = { sessionId: 'session-1', token: activeToken };

    expect(
      resolveRejectedLiveSessionChatSend({
        didUnmount: false,
        error: new Error('Socket closed'),
        liveSessionId: 'session-1',
        pendingSend,
        sendToken: staleToken,
      }),
    ).toEqual({
      failureEvent: null,
      nextPendingSend: pendingSend,
    });

    expect(
      resolveRejectedLiveSessionChatSend({
        didUnmount: true,
        error: 'offline',
        liveSessionId: 'session-1',
        pendingSend,
        sendToken: activeToken,
      }),
    ).toEqual({
      failureEvent: null,
      nextPendingSend: null,
    });
  });
});
