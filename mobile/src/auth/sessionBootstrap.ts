import type { AuthState, AuthTokenPair } from './types';

export function resolveSessionBootstrapState(
  storedTokens: AuthTokenPair | null,
): AuthState {
  if (!storedTokens) {
    return { status: 'unauthenticated' };
  }

  return {
    status: 'authenticated',
    tokens: storedTokens,
  };
}
