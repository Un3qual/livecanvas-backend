import { describe, expect, test } from 'bun:test';

import type { AuthTokenPair } from './types';
import { resolveSessionBootstrapState } from './sessionBootstrap';

describe('resolveSessionBootstrapState', () => {
  test('restores authenticated state when stored tokens exist even if the access token is expired', () => {
    const storedTokens: AuthTokenPair = {
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: '2000-01-01T00:00:00.000Z',
    };

    expect(resolveSessionBootstrapState(storedTokens)).toEqual({
      status: 'authenticated',
      tokens: storedTokens,
    });
  });

  test('restores unauthenticated state when no tokens are stored', () => {
    expect(resolveSessionBootstrapState(null)).toEqual({
      status: 'unauthenticated',
    });
  });
});
