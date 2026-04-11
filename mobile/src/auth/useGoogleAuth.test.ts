import { afterEach, describe, expect, mock, test } from 'bun:test';

const googleEnvKeys = [
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
] as const;

const originalGoogleEnv = Object.fromEntries(
  googleEnvKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof googleEnvKeys)[number], string | undefined>;

const useIdTokenAuthRequest = mock(() => [
  null,
  null,
  mock(async () => ({ type: 'dismiss' })),
] as const);

afterEach(() => {
  mock.restore();

  for (const key of googleEnvKeys) {
    const originalValue = originalGoogleEnv[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

mock.module('react', () => ({
  useCallback: (callback: (...args: unknown[]) => unknown) => callback,
  useMemo: <T>(factory: () => T) => factory(),
  useRef: <T>(initialValue: T) => ({ current: initialValue }),
  useState: <T>(initialValue: T) => [initialValue, () => undefined] as const,
}));

mock.module('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

mock.module('expo-web-browser', () => ({
  maybeCompleteAuthSession: () => undefined,
}));

mock.module('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest,
}));

mock.module('../providers/StartupGate', () => ({
  useStartupState: () => ({
    environment: {
      apiBaseUrl: 'https://api.example.com',
    },
  }),
}));

mock.module('./AuthProvider', () => ({
  useAuth: () => ({
    signIn: async () => undefined,
  }),
}));

describe('useGoogleAuth', () => {
  test('only reports support for Google config that works on the current platform', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';

    const { useGoogleAuth } = await import('./useGoogleAuth');

    const iosOnlyConfig = useGoogleAuth();

    expect(iosOnlyConfig.isConfigured).toBe(false);
    expect(iosOnlyConfig.isSupported).toBe(false);

    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'generic-client-id';

    const genericConfig = useGoogleAuth();

    expect(genericConfig.isConfigured).toBe(true);
    expect(genericConfig.isSupported).toBe(true);
    expect(useIdTokenAuthRequest).toHaveBeenCalledTimes(2);
  });
});
