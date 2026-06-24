import { describe, expect, test } from 'bun:test';

import { handleLiveSessionEndedRealtimeCleanup } from './liveSessionEndedRealtimeCleanup';

describe('handleLiveSessionEndedRealtimeCleanup', () => {
  test('stops viewer playback, releases host publishing, and closes chat for realtime ended sessions', () => {
    const calls: Array<{
      readonly name: string;
      readonly payload?: unknown;
    }> = [];

    handleLiveSessionEndedRealtimeCleanup({
      closeChatChannelForEndedSession: () => {
        calls.push({ name: 'close_chat' });
      },
      liveSessionId: 'live-session-id',
      releaseHostPublishing: (liveSessionId) => {
        calls.push({ name: 'release_host', payload: liveSessionId });
      },
      stopViewerPlayback: (options) => {
        calls.push({ name: 'stop_viewer', payload: options });
      },
    });

    expect(calls).toEqual([
      { name: 'stop_viewer', payload: { resetState: true } },
      { name: 'release_host', payload: 'live-session-id' },
      { name: 'close_chat' },
    ]);
  });
});
