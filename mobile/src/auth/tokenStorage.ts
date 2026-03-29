import * as SecureStore from 'expo-secure-store';
import type { AuthTokenPair } from './types';

const KEYS = {
  accessToken: 'lc_access_token',
  refreshToken: 'lc_refresh_token',
  expiresAt: 'lc_token_expires_at',
} as const;

export async function storeTokens(pair: AuthTokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, pair.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, pair.refreshToken),
    SecureStore.setItemAsync(KEYS.expiresAt, pair.expiresAt),
  ]);
}

export async function loadTokens(): Promise<AuthTokenPair | null> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.expiresAt),
  ]);
  if (!accessToken || !refreshToken || !expiresAt) return null;
  return { accessToken, refreshToken, expiresAt };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
    SecureStore.deleteItemAsync(KEYS.expiresAt),
  ]);
}
