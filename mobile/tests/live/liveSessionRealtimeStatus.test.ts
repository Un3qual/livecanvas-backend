import { describe, expect, test } from 'bun:test';

import {
  readLiveSessionRealtimeStatus,
  updateLiveSessionRealtimeStatus,
} from '../../src/live/liveSessionRealtimeStatus';

describe('liveSessionRealtimeStatus', () => {
  test('overrides queried status with the latest realtime session state for the same session', () => {
    const empty = new Map();

    expect(
      readLiveSessionRealtimeStatus({
        liveSessionId: 'live-session-id',
        queriedStatus: 'STARTING',
        realtimeStatuses: empty,
      }),
    ).toBe('STARTING');

    const withLiveStatus = updateLiveSessionRealtimeStatus({
      liveSessionId: 'live-session-id',
      realtimeStatuses: empty,
      status: 'LIVE',
    });

    expect(
      readLiveSessionRealtimeStatus({
        liveSessionId: 'live-session-id',
        queriedStatus: 'STARTING',
        realtimeStatuses: withLiveStatus,
      }),
    ).toBe('LIVE');
    expect(
      readLiveSessionRealtimeStatus({
        liveSessionId: 'other-session-id',
        queriedStatus: 'STARTING',
        realtimeStatuses: withLiveStatus,
      }),
    ).toBe('STARTING');
  });

  test('keeps realtime status maps stable when the status is unchanged', () => {
    const current = new Map([['live-session-id', 'ENDED' as const]]);

    expect(
      updateLiveSessionRealtimeStatus({
        liveSessionId: 'live-session-id',
        realtimeStatuses: current,
        status: 'ENDED',
      }),
    ).toBe(current);
  });
});
