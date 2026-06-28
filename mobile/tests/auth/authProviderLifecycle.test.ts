import { describe, expect, mock, test } from 'bun:test';

import {
  forceUnauthenticated,
  runBestEffortBeforeUnauthenticatedCallback,
} from '../../src/auth/authProviderLifecycle';

function returnUndefined(): undefined {
  return undefined;
}

describe('authProviderLifecycle', () => {
  test('forces an unauthenticated transition even if token clearing fails', async () => {
    const clearTokens = mock(() => {
      throw new Error('secure store unavailable');
    });
    const onForcedLogout = mock(returnUndefined);

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
    let resolveCleanup!: () => void;
    const pendingCleanup = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    const callback = mock(() => pendingCleanup);

    await expect(
      runBestEffortBeforeUnauthenticatedCallback(callback, 1),
    ).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalledTimes(1);
    resolveCleanup();
  });
});
