import { describe, expect, test } from 'bun:test';

import { readJoinableLiveSessionChannelTopic } from './liveSessionChannelTopic';

describe('liveSessionChannelTopic', () => {
  test('returns the opaque topic for active sessions', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: 'live_session:123',
        status: 'LIVE',
      }),
    ).toBe('live_session:123');
  });

  test('returns the exact opaque topic unchanged for active sessions', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: ' live_session:123 ',
        status: 'LIVE',
      }),
    ).toBe(' live_session:123 ');
  });

  test('does not expose a topic for ended sessions', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: 'live_session:123',
        status: 'ENDED',
      }),
    ).toBeNull();
  });

  test('rejects blank or missing topics', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: '   ',
        status: 'LIVE',
      }),
    ).toBeNull();
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: null,
        status: 'STARTING',
      }),
    ).toBeNull();
  });
});
