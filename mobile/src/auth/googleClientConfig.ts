export type GoogleClientConfig = {
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
};

export type GoogleClientPlatform = 'ios' | 'android' | 'web' | string;

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveGoogleClientConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleClientConfig {
  return {
    clientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_CLIENT_ID),
    iosClientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    androidClientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
    webClientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  };
}

export function hasGoogleClientConfig(
  config: GoogleClientConfig,
  platform: GoogleClientPlatform,
): boolean {
  if (config.clientId) {
    return true;
  }

  if (platform === 'ios') {
    return Boolean(config.iosClientId);
  }

  if (platform === 'android') {
    return Boolean(config.androidClientId);
  }

  if (platform === 'web') {
    return Boolean(config.webClientId);
  }

  return false;
}
