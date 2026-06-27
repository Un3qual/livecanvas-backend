import { describe, expect, test } from 'bun:test';

import { shouldMaintainLiveSessionRealtimeChannel } from '../../src/live/liveSessionRealtimeSubscription';

describe('shouldMaintainLiveSessionRealtimeChannel', () => {
  test('subscribes joined viewers and retained host publishers to session realtime events', () => {
    expect(
      shouldMaintainLiveSessionRealtimeChannel({
        hasRetainedHostPublishingSession: false,
        isJoined: false,
      }),
    ).toBe(false);
    expect(
      shouldMaintainLiveSessionRealtimeChannel({
        hasRetainedHostPublishingSession: false,
        isJoined: true,
      }),
    ).toBe(true);
    expect(
      shouldMaintainLiveSessionRealtimeChannel({
        hasRetainedHostPublishingSession: true,
        isJoined: false,
      }),
    ).toBe(true);
  });
});
