import { describe, expect, test } from 'vitest';

import {
  clearContactInviteHandoff,
  readContactInviteHandoffStatus,
  storeContactInviteHandoff,
  withContactInviteToken,
  type ContactInviteHandoffStorage,
} from '../../src/contacts/contactInviteHandoffCore';

function memoryStorage(): ContactInviteHandoffStorage & { value: string | null } {
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

describe('contact invite handoff', () => {
  test('stores one token for one hour and returns only its opaque handoff ID', async () => {
    const storage = memoryStorage();
    const result = await storeContactInviteHandoff('raw-secret', {
      createHandoffId: () => 'handoff-one',
      now: () => 1_000,
      storage,
    });

    expect(result).toEqual({ handoffId: 'handoff-one' });
    expect(storage.value).toBe(
      JSON.stringify({
        expiresAt: 3_601_000,
        handoffId: 'handoff-one',
        token: 'raw-secret',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('raw-secret');
  });

  test('replaces an older pending invite', async () => {
    const storage = memoryStorage();

    await storeContactInviteHandoff('token-a', {
      createHandoffId: () => 'handoff-a',
      now: () => 1_000,
      storage,
    });
    await storeContactInviteHandoff('token-b', {
      createHandoffId: () => 'handoff-b',
      now: () => 2_000,
      storage,
    });

    expect(await readContactInviteHandoffStatus('handoff-a', { now: () => 2_000, storage })).toBe('mismatch');
    expect(await readContactInviteHandoffStatus('handoff-b', { now: () => 2_000, storage })).toBe('matched');
  });

  test('clears an expired record regardless of the requested handoff', async () => {
    const storage = memoryStorage();
    storage.value = JSON.stringify({
      expiresAt: 999,
      handoffId: 'newer-route',
      token: 'expired-token',
    });

    expect(
      await readContactInviteHandoffStatus('stale-route', {
        now: () => 1_000,
        storage,
      }),
    ).toBe('expired');
    expect(storage.value).toBeNull();
  });

  test('clears an unreadable fixed-slot record', async () => {
    const storage = memoryStorage();
    storage.value = '{"token":"raw-but-corrupt"';

    expect(
      await readContactInviteHandoffStatus('handoff-a', { storage }),
    ).toBe('missing');
    expect(storage.value).toBeNull();
  });

  test('never gives a stale route access to a newer token or clears it', async () => {
    const storage = memoryStorage();
    await storeContactInviteHandoff('token-b', {
      createHandoffId: () => 'handoff-b',
      now: () => 1_000,
      storage,
    });
    let callbackCalls = 0;

    const result = await withContactInviteToken(
      'handoff-a',
      () => {
        callbackCalls += 1;
        return Promise.resolve('consumed');
      },
      { now: () => 2_000, storage },
    );

    expect(result).toEqual({ status: 'mismatch' });
    expect(callbackCalls).toBe(0);
    expect(await clearContactInviteHandoff('handoff-a', { storage })).toBe(false);
    expect(await readContactInviteHandoffStatus('handoff-b', { now: () => 2_000, storage })).toBe('matched');
  });

  test('serializes conditional clear with a replacement store', async () => {
    let releaseDelete!: () => void;
    let deleteStarted!: () => void;
    const deleteStartedPromise = new Promise<void>((resolve) => {
      deleteStarted = resolve;
    });
    const storage = memoryStorage();
    storage.value = JSON.stringify({
      expiresAt: 9_999,
      handoffId: 'handoff-a',
      token: 'token-a',
    });
    storage.deleteItem = async function deleteItem() {
      deleteStarted();
      await new Promise<void>((resolve) => {
        releaseDelete = resolve;
      });
      this.value = null;
    };

    const clear = clearContactInviteHandoff('handoff-a', { storage });
    await deleteStartedPromise;
    const store = storeContactInviteHandoff('token-b', {
      createHandoffId: () => 'handoff-b',
      now: () => 2_000,
      storage,
    });
    releaseDelete();
    await Promise.all([clear, store]);

    expect(await readContactInviteHandoffStatus('handoff-b', { now: () => 3_000, storage })).toBe('matched');
  });

  test('retains and reuses the same token across a response-lost retry', async () => {
    const storage = memoryStorage();
    await storeContactInviteHandoff('serialized-token', {
      createHandoffId: () => 'handoff-a',
      now: () => 1_000,
      storage,
    });
    const seenTokens: string[] = [];

    const first = await withContactInviteToken(
      'handoff-a',
      (token) => {
        seenTokens.push(token);
        return Promise.reject(new Error('response lost'));
      },
      { now: () => 2_000, storage },
    ).catch(() => 'retryable');
    const second = await withContactInviteToken(
      'handoff-a',
      (token) => {
        seenTokens.push(token);
        return Promise.resolve(true);
      },
      { now: () => 3_000, storage },
    );

    expect(first).toBe('retryable');
    expect(second).toEqual({ status: 'matched', value: true });
    expect(seenTokens).toEqual(['serialized-token', 'serialized-token']);
    expect(await readContactInviteHandoffStatus('handoff-a', { now: () => 3_000, storage })).toBe('matched');
  });
});
