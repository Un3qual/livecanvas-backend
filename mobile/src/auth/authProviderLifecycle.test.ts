import { describe, expect, mock, test } from 'bun:test';

import {
  forceUnauthenticated,
  runBestEffortBeforeUnauthenticatedCallback,
  shouldApplyBootstrapState,
} from './authProviderLifecycle';

describe('authProviderLifecycle', () => {
  test('allows bootstrap only while the provider is still loading', () => {
    expect(shouldApplyBootstrapState({ status: 'loading' }, false)).toBe(true);
    expect(shouldApplyBootstrapState({ status: 'authenticated', tokens: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-04-15T00:00:00.000Z',
    } }, false)).toBe(false);
    expect(shouldApplyBootstrapState({ status: 'loading' }, true)).toBe(false);
  });

  test('forces an unauthenticated transition even if token clearing fails', async () => {
    const clearTokens = mock(async () => {
      throw new Error('secure store unavailable');
    });
    const onForcedLogout = mock(() => {});

    await expect(forceUnauthenticated(clearTokens, onForcedLogout)).resolves.toBeUndefined();
    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(onForcedLogout).toHaveBeenCalledTimes(1);
  });

  test('runs cleanup before clearing tokens during a local auth loss', async () => {
    const calls: string[] = [];
    const clearTokens = mock(() => {
      calls.push('clearTokens');
      return Promise.resolve();
    });
    const onForcedLogout = mock(() => {
      calls.push('onForcedLogout');
    });

    await expect(
      forceUnauthenticated(clearTokens, onForcedLogout, () => {
        calls.push('beforeUnauthenticated');
      }),
    ).resolves.toBeUndefined();

    expect(calls).toEqual([
      'beforeUnauthenticated',
      'clearTokens',
      'onForcedLogout',
    ]);
  });

  test('bounds best-effort cleanup callbacks before auth teardown', async () => {
    const callback = mock(() => new Promise<void>(() => {}));

    await expect(
      runBestEffortBeforeUnauthenticatedCallback(callback, 1),
    ).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
