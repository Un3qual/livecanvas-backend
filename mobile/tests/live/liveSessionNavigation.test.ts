import { describe, expect, test } from 'vitest';

import {
  liveSessionHref,
  readLiveSessionIdParam,
} from '../../src/live/liveSessionNavigation';

describe('liveSessionNavigation', () => {
  test('builds a stable modal href with the Relay live-session ID as a query param', () => {
    expect(liveSessionHref('TGl2ZVNlc3Npb246MTIz')).toEqual({
      pathname: '/live-session',
      params: { sessionId: 'TGl2ZVNlc3Npb246MTIz' },
    });
  });

  test('reads the first session ID when Expo Router provides repeated params', () => {
    expect(readLiveSessionIdParam(['first', 'second'])).toBe('first');
    expect(readLiveSessionIdParam(['   ', 'second'])).toBe('second');
  });

  test('rejects missing or blank session ID params', () => {
    expect(readLiveSessionIdParam()).toBeNull();
    expect(readLiveSessionIdParam('   ')).toBeNull();
  });
});
