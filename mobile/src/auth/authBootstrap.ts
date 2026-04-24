import type { AuthState, AuthTokenPair } from './types';
import { restoreStoredSession } from './sessionBootstrap';

type AuthBootstrapDependencies = {
  apiBaseUrl: string;
  readTokens: () => Promise<AuthTokenPair | null>;
  storeTokens: (tokens: AuthTokenPair) => Promise<void>;
  clearTokens: () => Promise<void>;
  fetchImpl?: typeof fetch;
};

/**
 * Load the initial auth state for provider bootstrap.
 * Storage read failures are treated as an unauthenticated session so the UI can continue.
 */
export async function resolveAuthBootstrapState(
  dependencies: AuthBootstrapDependencies,
): Promise<AuthState> {
  try {
    return await restoreStoredSession(dependencies.apiBaseUrl, dependencies);
  } catch {
    return { status: 'unauthenticated' };
  }
}
