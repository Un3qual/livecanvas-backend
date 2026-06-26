import type { AuthState, BeforeUnauthenticatedCallback } from './types';

export const BEFORE_UNAUTHENTICATED_CALLBACK_TIMEOUT_MS = 5_000;

export function shouldApplyBootstrapState(
  currentState: AuthState,
  bootstrapRan: boolean,
): boolean {
  return !bootstrapRan && currentState.status === 'loading';
}

export async function runBestEffortBeforeUnauthenticatedCallback(
  callback: BeforeUnauthenticatedCallback,
  timeoutMs = BEFORE_UNAUTHENTICATED_CALLBACK_TIMEOUT_MS,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      Promise.resolve().then(callback),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function forceUnauthenticated(
  clearTokens: () => Promise<void>,
  onForcedLogout: () => void | Promise<void>,
  beforeUnauthenticated?: () => void | Promise<void>,
): Promise<void> {
  try {
    await beforeUnauthenticated?.();
  } catch {
    // Signing out must still clear local auth if best-effort cleanup fails.
  }

  try {
    await clearTokens();
  } catch {
    // Keep the app in a signed-out state even if SecureStore deletion fails.
  }

  await onForcedLogout();
}
