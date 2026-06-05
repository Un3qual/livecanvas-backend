import { describe, expect, test } from 'bun:test';

import { createLiveSessionChatChannelLifecycle } from './liveSessionChatChannelLifecycle';

describe('createLiveSessionChatChannelLifecycle', () => {
  test('closes an ended session join once and prevents later active callbacks', () => {
    let clientRef: 'client' | null = 'client';
    let failedSendCount = 0;
    let closedStatusCount = 0;
    let joinedStatusCount = 0;
    let leaveCount = 0;
    let disconnectCount = 0;
    const lifecycle = createLiveSessionChatChannelLifecycle({
      clearClientRef: () => {
        clientRef = null;
      },
      disconnectSocket: () => {
        disconnectCount += 1;
      },
      failPendingSendForEndedSession: () => {
        failedSendCount += 1;
      },
      leaveChannel: () => {
        leaveCount += 1;
      },
      markClosedForEndedSession: () => {
        closedStatusCount += 1;
      },
    });

    lifecycle.closeForEndedSession();
    lifecycle.closeForEndedSession();
    lifecycle.runIfActive(() => {
      joinedStatusCount += 1;
    });

    expect(clientRef).toBeNull();
    expect(failedSendCount).toBe(1);
    expect(closedStatusCount).toBe(1);
    expect(joinedStatusCount).toBe(0);
    expect(leaveCount).toBe(1);
    expect(disconnectCount).toBe(1);
  });
});
