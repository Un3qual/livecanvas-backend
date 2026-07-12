import { beforeEach, describe, expect, mock, test } from 'bun:test';

let storedValue: string | null = null;
let storageShouldFail = false;
let nextHandoffId = '550e8400-e29b-41d4-a716-446655440010';
let storageWrites = 0;

mock.module('expo-crypto', () => ({
  randomUUID: () => nextHandoffId,
}));

mock.module('react-native', () => ({
  Linking: { getInitialURL: () => Promise.resolve(null) },
}));

mock.module('expo-secure-store', () => ({
  deleteItemAsync: async () => {
    storedValue = null;
  },
  getItemAsync: async () => storedValue,
  setItemAsync: async (_key: string, value: string) => {
    storageWrites += 1;

    if (storageShouldFail) {
      throw new Error('storage details must remain private');
    }

    storedValue = value;
  },
}));

const { redirectSystemPath } = await import('../../app/+native-intent');
const { bootstrapRuntime } = await import('../../src/config/runtime');

const environment = {
  apiBaseUrl: 'https://api.example.test',
  publicAppOrigin: 'https://app.example.test',
  websocketUrl: 'wss://api.example.test/socket',
  bootSessionState: 'signed_out' as const,
};

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ORIGIN = 'https://app.example.test/';
  storedValue = null;
  storageShouldFail = false;
  nextHandoffId = '550e8400-e29b-41d4-a716-446655440010';
  storageWrites = 0;
});

describe('Expo Router contact invite native intent', () => {
  test('persists and rewrites a cold custom-scheme link before bootstrap sees it', async () => {
    const rawUrl = 'livecanvas-mobile://invite?token=cold-secret';
    const href = await redirectSystemPath({ initial: true, path: rawUrl });

    expect(href).toBe(
      '/invite?handoff=550e8400-e29b-41d4-a716-446655440010',
    );
    expect(storedValue).toContain('cold-secret');
    expect(JSON.stringify(href)).not.toContain('cold-secret');

    const snapshot = await bootstrapRuntime(environment, {
      getInitialUrl: () => Promise.resolve(rawUrl),
    });

    expect(snapshot.initialUrl).toBe('/invite');
    expect(snapshot.initialHref).toBe('/invite');
    expect(JSON.stringify(snapshot)).not.toContain('cold-secret');
    expect(storageWrites).toBe(1);
  });

  test('persists and rewrites a warm HTTPS fragment without a token-bearing route', async () => {
    nextHandoffId = '550e8400-e29b-41d4-a716-446655440011';

    const href = await redirectSystemPath({
      initial: false,
      path: 'https://app.example.test/invites#token=warm-secret',
    });

    expect(href).toBe(
      '/invite?handoff=550e8400-e29b-41d4-a716-446655440011',
    );
    expect(storedValue).toContain('warm-secret');
    expect(JSON.stringify(href)).not.toContain('warm-secret');
    expect(storageWrites).toBe(1);
  });

  test('fails closed for a wrong-origin HTTPS invite without writing protected storage', async () => {
    const rawUrl =
      'https://wrong.example.test/invites#token=wrong-origin-secret';
    const href = await redirectSystemPath({ initial: false, path: rawUrl });

    expect(href).toBe('/invite');
    expect(JSON.stringify(href)).not.toContain('wrong-origin-secret');
    expect(storageWrites).toBe(0);

    const snapshot = await bootstrapRuntime(environment, {
      getInitialUrl: () => Promise.resolve(rawUrl),
    });

    expect(snapshot.initialUrl).toBe('/invite');
    expect(snapshot.initialHref).toBe('/invite');
    expect(JSON.stringify(snapshot)).not.toContain('wrong-origin-secret');
  });

  test('fails closed for invalid public-origin configuration without storing a token', async () => {
    process.env.EXPO_PUBLIC_APP_ORIGIN = 'https://livecanvas.invalid';

    const href = await redirectSystemPath({
      initial: false,
      path: 'https://livecanvas.invalid/invites#token=config-secret',
    });

    expect(href).toBe('/invite');
    expect(JSON.stringify(href)).not.toContain('config-secret');
    expect(storageWrites).toBe(0);
  });

  test('maps malformed links and protected-storage failure to generic invite', async () => {
    expect(
      await redirectSystemPath({
        initial: false,
        path: 'livecanvas-mobile://invite?token=one&token=two',
      }),
    ).toBe('/invite');

    storageShouldFail = true;
    const failed = await redirectSystemPath({
      initial: true,
      path: 'livecanvas-mobile://invite?token=storage-secret',
    });

    expect(failed).toBe('/invite');
    expect(JSON.stringify(failed)).not.toContain('storage-secret');
  });

  test('rejects credentials and unexpected ports on exact invite URL forms', async () => {
    for (const path of [
      'livecanvas-mobile://user@invite?token=secret',
      'livecanvas-mobile://user:password@invite?token=secret',
      'livecanvas-mobile://invite:444?token=secret',
      'livecanvas-mobile://invite:not-a-port?token=secret',
      'https://user@app.example.test/invites#token=secret',
      'https://user:password@app.example.test/invites#token=secret',
      'https://app.example.test:8443/invites#token=secret',
      'https://app.example.test:not-a-port/invites#token=secret',
    ]) {
      expect(await redirectSystemPath({ initial: false, path })).toBe(
        '/invite',
      );
    }

    expect(storageWrites).toBe(0);
  });

  test('fails closed for structurally recognizable malformed custom-scheme invites', async () => {
    const longSlashRunCandidates = [4, 12, 64].map(
      (slashCount) =>
        `livecanvas-mobile:${'/'.repeat(slashCount)}invite?token=raw-secret`,
    );

    for (const path of [
      'livecanvas-mobile:/invite?token=raw-secret',
      'livecanvas-mobile:///invite?token=raw-secret',
      'livecanvas-mobile:invite?token=raw-secret',
      'livecanvas-mobile://user@invite:not-a-port?token=raw-secret',
      ...longSlashRunCandidates,
    ]) {
      const href = await redirectSystemPath({ initial: false, path });

      expect(href).toBe('/invite');
      expect(JSON.stringify(href)).not.toContain('raw-secret');
    }

    expect(storageWrites).toBe(0);
  });

  test('passes unrelated incoming paths through unchanged', async () => {
    for (const path of [
      'livecanvas-mobile://profile',
      'livecanvas-mobile:/contacts?filter=invite',
      'livecanvas-mobile:settings?token=not-an-invite-token',
      'https://marketing.example.test/news#token=not-an-invite-token',
    ]) {
      expect(await redirectSystemPath({ initial: false, path })).toBe(path);
    }
  });
});
