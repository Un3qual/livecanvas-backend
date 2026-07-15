import { beforeEach, describe, expect, test, vi } from 'vitest';

let storedValue: string | null = null;
let storageWrites = 0;
let nextHandoffId = '550e8400-e29b-41d4-a716-446655440020';

vi.doMock('expo-crypto', () => ({
  randomUUID: () => nextHandoffId,
}));

vi.doMock('react-native', () => ({
  Linking: { getInitialURL: () => Promise.resolve(null) },
}));

vi.doMock('expo-secure-store', () => ({
  deleteItemAsync: () => {
    storedValue = null;
    return Promise.resolve();
  },
  getItemAsync: () => Promise.resolve(storedValue),
  setItemAsync: (_key: string, value: string) => {
    storageWrites += 1;
    storedValue = value;
    return Promise.resolve();
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
  storageWrites = 0;
  nextHandoffId = '550e8400-e29b-41d4-a716-446655440020';
});

describe('Expo Router magic-link native intent', () => {
  test.each([
    [
      'livecanvas-mobile://magic-link/sign-in?token=custom-secret',
      'signIn',
    ],
    [
      'https://app.example.test/auth/magic-link/sign-up#token=https-secret',
      'signUp',
    ],
  ] as const)('stores and rewrites a valid raw link', async (rawUrl, purpose) => {
    const href = await redirectSystemPath({ initial: true, path: rawUrl });

    expect(href).toBe(
      '/magic-link?handoff=550e8400-e29b-41d4-a716-446655440020',
    );
    expect(storedValue).toContain(purpose);
    expect(storedValue).toContain('secret');
    expect(JSON.stringify(href)).not.toContain('secret');
    expect(storageWrites).toBe(1);

    const snapshot = await bootstrapRuntime(environment, {
      getInitialUrl: () => Promise.resolve(rawUrl),
    });

    expect(snapshot.initialUrl).toBe('/magic-link');
    expect(snapshot.initialHref).toBe('/magic-link');
    expect(JSON.stringify(snapshot)).not.toContain('secret');
  });

  test('fails closed without storage writes for malformed or wrong-origin links', async () => {
    for (const rawUrl of [
      'livecanvas-mobile://magic-link/sign-in?token=one&token=two',
      'https://wrong.example.test/auth/magic-link/sign-in#token=wrong-secret',
    ]) {
      expect(await redirectSystemPath({ initial: false, path: rawUrl })).toBe(
        '/magic-link',
      );
    }

    expect(storageWrites).toBe(0);
  });

  test('leaves unrelated deep links unchanged', async () => {
    expect(
      await redirectSystemPath({
        initial: false,
        path: 'livecanvas-mobile://profile',
      }),
    ).toBe('livecanvas-mobile://profile');
    expect(storageWrites).toBe(0);
  });
});
