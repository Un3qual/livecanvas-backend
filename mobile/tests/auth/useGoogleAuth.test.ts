import { describe, expect, test } from 'bun:test';

import {
  hasGoogleClientConfig,
  resolveGoogleClientConfig,
} from '../../src/auth/googleClientConfig';

function googleEnv(
  overrides: Partial<Record<string, string | undefined>> = {},
): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_GOOGLE_CLIENT_ID: undefined,
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: undefined,
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: undefined,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: undefined,
    ...overrides,
  };
}

describe('resolveGoogleClientConfig', () => {
  test('trims blank environment values to undefined', () => {
    expect(
      resolveGoogleClientConfig(
        googleEnv({
          EXPO_PUBLIC_GOOGLE_CLIENT_ID: '  ',
          EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: ' android-client-id ',
        }),
      ),
    ).toEqual({
      clientId: undefined,
      iosClientId: undefined,
      androidClientId: 'android-client-id',
      webClientId: undefined,
    });
  });
});

describe('hasGoogleClientConfig', () => {
  test('requires a matching platform-specific client when the generic ID is absent', () => {
    const iosOnlyConfig = resolveGoogleClientConfig(
      googleEnv({
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios-client-id',
      }),
    );

    expect(hasGoogleClientConfig(iosOnlyConfig, 'ios')).toBe(true);
    expect(hasGoogleClientConfig(iosOnlyConfig, 'android')).toBe(false);
    expect(hasGoogleClientConfig(iosOnlyConfig, 'web')).toBe(false);
  });

  test('accepts the generic client ID on every supported platform', () => {
    const genericConfig = resolveGoogleClientConfig(
      googleEnv({
        EXPO_PUBLIC_GOOGLE_CLIENT_ID: 'generic-client-id',
      }),
    );

    expect(hasGoogleClientConfig(genericConfig, 'ios')).toBe(true);
    expect(hasGoogleClientConfig(genericConfig, 'android')).toBe(true);
    expect(hasGoogleClientConfig(genericConfig, 'web')).toBe(true);
  });
});
