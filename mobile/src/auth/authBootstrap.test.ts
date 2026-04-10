import { describe, expect, test } from 'bun:test';

import { resolveAuthBootstrapState } from './authBootstrap';

describe('resolveAuthBootstrapState', () => {
  test('falls back to unauthenticated when token storage read fails', async () => {
    const state = await resolveAuthBootstrapState(async () => {
      throw new Error('secure store unavailable');
    });

    expect(state).toEqual({ status: 'unauthenticated' });
  });
});
