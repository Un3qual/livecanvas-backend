import { describe, expect, test } from 'bun:test';

import { handleLiveSessionEndedRealtimeCleanup } from './liveSessionEndedRealtimeCleanup';

describe('handleLiveSessionEndedRealtimeCleanup', () => {
  test('clears watch state, stops media, releases host publishing, and closes chat for realtime ended sessions', () => {
    const calls: Array<{
      readonly name: string;
      readonly payload?: unknown;
    }> = [];

    handleLiveSessionEndedRealtimeCleanup({
      clearEndedSessionMembership: (liveSessionId) => {
        calls.push({ name: 'clear_membership', payload: liveSessionId });
      },
      closeChatChannelForEndedSession: () => {
        calls.push({ name: 'close_chat' });
      },
      liveSessionId: 'live-session-id',
      markLiveSessionEnded: (liveSessionId) => {
        calls.push({ name: 'mark_ended', payload: liveSessionId });
      },
      releaseHostPublishing: (liveSessionId) => {
        calls.push({ name: 'release_host', payload: liveSessionId });
      },
      stopViewerPlayback: (options) => {
        calls.push({ name: 'stop_viewer', payload: options });
      },
    });

    expect(calls).toEqual([
      { name: 'mark_ended', payload: 'live-session-id' },
      { name: 'clear_membership', payload: 'live-session-id' },
      { name: 'stop_viewer', payload: { resetState: true } },
      { name: 'release_host', payload: 'live-session-id' },
      { name: 'close_chat' },
    ]);
  });
});
