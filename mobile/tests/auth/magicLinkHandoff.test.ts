import { describe, expect, test } from 'vitest';

import {
  clearMagicLinkHandoff,
  storeMagicLinkHandoff,
  withMagicLinkHandoff,
  type MagicLinkHandoffStorage,
} from '../../src/auth/magicLink/magicLinkHandoffCore';

function memoryStorage(): MagicLinkHandoffStorage & { value: string | null } {
  return {
    value: null,
    deleteItem() {
      this.value = null;
      return Promise.resolve();
    },
    getItem() {
      return Promise.resolve(this.value);
    },
    setItem(_key, value) {
      this.value = value;
      return Promise.resolve();
    },
  };
}

describe('magic-link handoff', () => {
  test('stores one purpose and token behind only an opaque handoff ID', async () => {
    const storage = memoryStorage();
    const result = await storeMagicLinkHandoff(
      { purpose: 'signUp', token: 'raw-secret' },
      {
        createHandoffId: () => 'handoff-one',
        now: () => 1_000,
        storage,
      },
    );

    expect(result).toEqual({ handoffId: 'handoff-one' });
    expect(storage.value).toContain('raw-secret');
    expect(storage.value).toContain('signUp');
    expect(JSON.stringify(result)).not.toContain('raw-secret');
  });

  test('never gives a stale route access to or cleanup authority over a newer link', async () => {
    const storage = memoryStorage();
    await storeMagicLinkHandoff(
      { purpose: 'signIn', token: 'new-token' },
      {
        createHandoffId: () => 'handoff-b',
        now: () => 1_000,
        storage,
      },
    );
    let callbackCalls = 0;

    const result = await withMagicLinkHandoff(
      'handoff-a',
      () => {
        callbackCalls += 1;
        return Promise.resolve('redeemed');
      },
      { now: () => 2_000, storage },
    );

    expect(result).toEqual({ status: 'mismatch' });
    expect(callbackCalls).toBe(0);
    expect(await clearMagicLinkHandoff('handoff-a', { storage })).toBe(false);
    expect(
      await withMagicLinkHandoff(
        'handoff-b',
        (payload) => Promise.resolve(payload),
        { now: () => 2_000, storage },
      ),
    ).toEqual({
      status: 'matched',
      value: { purpose: 'signIn', token: 'new-token' },
    });
  });

  test('clears expired and corrupt fixed-slot records', async () => {
    const storage = memoryStorage();
    storage.value = JSON.stringify({
      expiresAt: 999,
      handoffId: 'handoff-a',
      purpose: 'signIn',
      token: 'expired-token',
    });

    expect(
      await withMagicLinkHandoff(
        'handoff-a',
        () => Promise.resolve(true),
        { now: () => 1_000, storage },
      ),
    ).toEqual({ status: 'expired' });
    expect(storage.value).toBeNull();

    storage.value = '{"token":"raw-but-corrupt"';
    expect(
      await withMagicLinkHandoff(
        'handoff-a',
        () => Promise.resolve(true),
        { storage },
      ),
    ).toEqual({ status: 'missing' });
    expect(storage.value).toBeNull();
  });

  test('serializes conditional cleanup with a replacement store', async () => {
    let releaseDelete!: () => void;
    let deleteStarted!: () => void;
    const deleteStartedPromise = new Promise<void>((resolve) => {
      deleteStarted = resolve;
    });
    const storage = memoryStorage();
    storage.value = JSON.stringify({
      expiresAt: 999_999,
      handoffId: 'handoff-a',
      purpose: 'signIn',
      token: 'token-a',
    });
    storage.deleteItem = async function deleteItem() {
      deleteStarted();
      await new Promise<void>((resolve) => {
        releaseDelete = resolve;
      });
      this.value = null;
    };

    const clear = clearMagicLinkHandoff('handoff-a', { storage });
    await deleteStartedPromise;
    const store = storeMagicLinkHandoff(
      { purpose: 'signUp', token: 'token-b' },
      {
        createHandoffId: () => 'handoff-b',
        now: () => 2_000,
        storage,
      },
    );
    releaseDelete();
    await Promise.all([clear, store]);

    expect(
      await withMagicLinkHandoff(
        'handoff-b',
        (payload) => Promise.resolve(payload.token),
        { now: () => 3_000, storage },
      ),
    ).toEqual({ status: 'matched', value: 'token-b' });
  });

  test('coalesces redemption and retains a definitive result until cleanup', async () => {
    const storage = memoryStorage();
    await storeMagicLinkHandoff(
      { purpose: 'signIn', token: 'single-use-token' },
      {
        createHandoffId: () => 'handoff-a',
        now: () => 1_000,
        storage,
      },
    );
    let resolveRedemption!: (value: string) => void;
    const redemption = new Promise<string>((resolve) => {
      resolveRedemption = resolve;
    });
    let callbackCalls = 0;
    const redeem = () => {
      callbackCalls += 1;
      return redemption;
    };
    const options = {
      now: () => 2_000,
      shouldRetainResult: () => true,
      storage,
    };

    const first = withMagicLinkHandoff('handoff-a', redeem, options);
    const concurrent = withMagicLinkHandoff('handoff-a', redeem, options);

    resolveRedemption('redeemed-tokens');
    await expect(Promise.all([first, concurrent])).resolves.toEqual([
      { status: 'matched', value: 'redeemed-tokens' },
      { status: 'matched', value: 'redeemed-tokens' },
    ]);
    expect(callbackCalls).toBe(1);
    await expect(
      withMagicLinkHandoff('handoff-a', redeem, options),
    ).resolves.toEqual({ status: 'matched', value: 'redeemed-tokens' });
    expect(callbackCalls).toBe(1);

    await expect(clearMagicLinkHandoff('handoff-a', { storage })).resolves.toBe(
      true,
    );
    await expect(
      withMagicLinkHandoff('handoff-a', redeem, options),
    ).resolves.toEqual({ status: 'missing' });
    expect(callbackCalls).toBe(1);
  });

  test('releases retryable redemption results for a later attempt', async () => {
    const storage = memoryStorage();
    await storeMagicLinkHandoff(
      { purpose: 'signIn', token: 'retryable-token' },
      {
        createHandoffId: () => 'handoff-a',
        now: () => 1_000,
        storage,
      },
    );
    let callbackCalls = 0;
    const redeem = () => {
      callbackCalls += 1;
      return Promise.resolve(callbackCalls === 1 ? 'retryable' : 'redeemed');
    };
    const options = {
      now: () => 2_000,
      shouldRetainResult: (value: string) => value !== 'retryable',
      storage,
    };

    await expect(
      withMagicLinkHandoff('handoff-a', redeem, options),
    ).resolves.toEqual({ status: 'matched', value: 'retryable' });
    await expect(
      withMagicLinkHandoff('handoff-a', redeem, options),
    ).resolves.toEqual({ status: 'matched', value: 'redeemed' });
    expect(callbackCalls).toBe(2);
  });
});
