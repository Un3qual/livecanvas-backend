import type { AuthState } from './types';

export function shouldApplyBootstrapState(
  currentState: AuthState,
  bootstrapRan: boolean,
): boolean {
  return !bootstrapRan && currentState.status === 'loading';
}

export async function forceUnauthenticated(
  clearTokens: () => Promise<void>,
  onForcedLogout: () => void | Promise<void>,
): Promise<void> {
  try {
    await clearTokens();
  } catch {
    // Keep the app in a signed-out state even if SecureStore deletion fails.
  }

  await onForcedLogout();
}
