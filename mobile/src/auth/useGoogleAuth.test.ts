import { afterEach, describe, expect, test } from 'bun:test';

import {
  hasGoogleClientConfig,
  resolveGoogleClientConfig,
} from './googleClientConfig';

const googleEnvKeys = [
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
] as const;

const originalGoogleEnv = Object.fromEntries(
  googleEnvKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof googleEnvKeys)[number], string | undefined>;

afterEach(() => {
  for (const key of googleEnvKeys) {
    const originalValue = originalGoogleEnv[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

describe('resolveGoogleClientConfig', () => {
  test('trims blank environment values to undefined', () => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = '  ';
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ' android-client-id ';

    expect(resolveGoogleClientConfig()).toEqual({
      clientId: undefined,
      iosClientId: undefined,
      androidClientId: 'android-client-id',
      webClientId: undefined,
    });
  });
});

describe('hasGoogleClientConfig', () => {
  test('requires a matching platform-specific client when the generic ID is absent', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';

    const iosOnlyConfig = resolveGoogleClientConfig();

    expect(hasGoogleClientConfig(iosOnlyConfig, 'ios')).toBe(true);
    expect(hasGoogleClientConfig(iosOnlyConfig, 'android')).toBe(false);
    expect(hasGoogleClientConfig(iosOnlyConfig, 'web')).toBe(false);
  });

  test('accepts the generic client ID on every supported platform', () => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'generic-client-id';

    const genericConfig = resolveGoogleClientConfig();

    expect(hasGoogleClientConfig(genericConfig, 'ios')).toBe(true);
    expect(hasGoogleClientConfig(genericConfig, 'android')).toBe(true);
    expect(hasGoogleClientConfig(genericConfig, 'web')).toBe(true);
  });
});
