import type { AuthState, AuthTokenPair } from './types';
import { resolveSessionBootstrapState } from './sessionBootstrap';

/**
 * Load the initial auth state for provider bootstrap.
 * Storage read failures are treated as an unauthenticated session so the UI can continue.
 */
export async function resolveAuthBootstrapState(
  readTokens: () => Promise<AuthTokenPair | null>,
): Promise<AuthState> {
  try {
    return resolveSessionBootstrapState(await readTokens());
  } catch {
    return { status: 'unauthenticated' };
  }
}
