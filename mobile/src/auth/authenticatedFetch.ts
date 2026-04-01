import type { FetchFunction, GraphQLResponse } from 'relay-runtime';
import { loadTokens, storeTokens, clearTokens } from './tokenStorage';
import type { AuthTokenPair } from './types';
import {
  REFRESH_MUTATION,
  buildTokenPair,
  extractRefreshedAuthTokens,
  hasUnauthenticatedError,
} from './authenticatedFetchHelpers';

/** Callback invoked when auth is unrecoverably invalid (expired/revoked refresh). */
export type OnForcedLogout = () => void;

async function rawFetch(
  apiBaseUrl: string,
  query: string,
  variables: Record<string, unknown>,
  accessToken?: string | null,
): Promise<GraphQLResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const res = await fetch(`${apiBaseUrl}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function attemptRefresh(
  apiBaseUrl: string,
  refreshToken: string,
): Promise<AuthTokenPair | null> {
  const res = await rawFetch(apiBaseUrl, REFRESH_MUTATION, {
    input: { refreshToken },
  });
  const tokens = extractRefreshedAuthTokens(res);
  if (!tokens) return null;
  // Backend returns serialized token strings; compute expiresAt as 14 days from now
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const pair = buildTokenPair(tokens.accessToken, tokens.refreshToken, expiresAt);
  await storeTokens(pair);
  return pair;
}

/**
 * Create an authenticated Relay fetch function.
 * - Injects Bearer token on every request.
 * - On auth errors, attempts transparent token refresh and retries once.
 * - On unrecoverable auth failure, clears tokens and calls onForcedLogout.
 */
export function createAuthenticatedFetch(
  apiBaseUrl: string,
  onForcedLogout: OnForcedLogout,
): FetchFunction {
  // Serialize concurrent refresh attempts to avoid race conditions
  let refreshPromise: Promise<AuthTokenPair | null> | null = null;

  return async (operation, variables) => {
    const tokens = await loadTokens();
    const response = await rawFetch(apiBaseUrl, operation.text ?? '', variables, tokens?.accessToken);
    const authError = hasUnauthenticatedError(response);

    if (!authError || !tokens?.refreshToken) {
      // If auth error with no refresh token, force logout
      if (authError) {
        await clearTokens();
        onForcedLogout();
      }
      return response;
    }

    // Claim the refresh lock before any await so concurrent failures cannot
    // race past the guard and start multiple refresh attempts.
    if (!refreshPromise) {
      // Resolve the shared promise with the latest usable token pair once the
      // refresh path finishes, while the first caller can still return a sibling
      // retry response directly when it succeeds.
      let resolveRefreshPromise!: (value: AuthTokenPair | null) => void;
      refreshPromise = new Promise<AuthTokenPair | null>((resolve) => {
        resolveRefreshPromise = resolve;
      }).finally(() => {
        refreshPromise = null;
      });

      try {
        // Re-read storage so a sibling request that already refreshed the session
        // can supply the latest token pair instead of reusing a rotated refresh token.
        const latestTokens = await loadTokens();
        if (latestTokens?.accessToken && latestTokens.accessToken !== tokens.accessToken) {
          const retryResponse = await rawFetch(
            apiBaseUrl,
            operation.text ?? '',
            variables,
            latestTokens.accessToken,
          );

          if (!hasUnauthenticatedError(retryResponse)) {
            resolveRefreshPromise(latestTokens);
            return retryResponse;
          }
        }

        const refreshToken = latestTokens?.refreshToken ?? tokens.refreshToken;
        resolveRefreshPromise(await attemptRefresh(apiBaseUrl, refreshToken));
      } catch {
        resolveRefreshPromise(null);
      }
    }
    const newTokens = await refreshPromise;

    if (!newTokens) {
      await clearTokens();
      onForcedLogout();
      return response;
    }

    // Retry the original request with new tokens
    return rawFetch(apiBaseUrl, operation.text ?? '', variables, newTokens.accessToken);
  };
}
