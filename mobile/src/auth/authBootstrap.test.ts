import { describe, expect, test } from 'bun:test';

import { resolveAuthBootstrapState } from './authBootstrap';

describe('resolveAuthBootstrapState', () => {
  test('falls back to unauthenticated when token storage read fails', async () => {
    const state = await resolveAuthBootstrapState({
      apiBaseUrl: 'http://localhost:4000',
      readTokens: async () => {
        throw new Error('secure store unavailable');
      },
      storeTokens: async () => {},
      clearTokens: async () => {},
    });

    expect(state).toEqual({ status: 'unauthenticated' });
  });
});
