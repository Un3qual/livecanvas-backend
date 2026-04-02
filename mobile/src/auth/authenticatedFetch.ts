import type { FetchFunction, GraphQLResponse } from 'relay-runtime';
import { loadTokens, storeTokens, clearTokens } from './tokenStorage';
import type { AuthState, AuthTokenPair } from './types';
import {
  REFRESH_MUTATION,
  buildTokenPair,
  extractRefreshedAuthTokens,
  hasUnauthenticatedError,
} from './authenticatedFetchHelpers';

/** Callback invoked when auth is unrecoverably invalid (expired/revoked refresh). */
export type OnForcedLogout = () => void | Promise<void>;
export type OnTokensChanged = (tokens: AuthTokenPair) => void | Promise<void>;

const ACCESS_TOKEN_TTL_DAYS = 14;
const TRANSIENT_REFRESH_FAILURE = Symbol('transient_refresh_failure');
const SESSION_INACTIVE = Symbol('session_inactive');
const SESSION_CHANGED = Symbol('session_changed');

/** Refresh failed for a specific session (revoked or expired refresh token). */
interface RefreshFailed {
  readonly _tag: 'RefreshFailed';
  readonly refreshToken: string;
}

function makeRefreshFailed(refreshToken: string): RefreshFailed {
  return { _tag: 'RefreshFailed', refreshToken };
}

function isRefreshFailed(result: RefreshResult): result is RefreshFailed {
  return typeof result === 'object' && result !== null && (result as RefreshFailed)._tag === 'RefreshFailed';
}

type GetAuthStatus = () => AuthState['status'];
type RefreshResult =
  | AuthTokenPair
  | RefreshFailed
  | typeof SESSION_INACTIVE
  | typeof SESSION_CHANGED
  | typeof TRANSIENT_REFRESH_FAILURE;

async function loadTokensOrNull(): Promise<AuthTokenPair | null> {
  try {
    return await loadTokens();
  } catch {
    return null;
  }
}

function fallbackAccessTokenExpiresAt(): string {
  // The current backend contract does not populate Token.expiresAt yet, so
  // mirror the documented 14-day access-token TTL until it does.
  return new Date(Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function summarizeResponseBody(bodyText: string): string {
  const normalized = bodyText.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  return normalized.length > 200 ? `${normalized.slice(0, 197)}...` : normalized;
}

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
  const bodyText = await res.text();

  if (!res.ok) {
    const bodySummary = summarizeResponseBody(bodyText);
    const details = bodySummary ? `: ${bodySummary}` : '';
    throw new Error(`GraphQL request failed with ${res.status} ${res.statusText}${details}`);
  }

  if (!bodyText.trim()) {
    throw new Error('GraphQL response body was empty');
  }

  try {
    return JSON.parse(bodyText) as GraphQLResponse;
  } catch {
    throw new Error(`GraphQL response was not valid JSON (${res.status} ${res.statusText})`);
  }
}

async function attemptRefresh(
  apiBaseUrl: string,
  refreshToken: string,
): Promise<AuthTokenPair | null | typeof SESSION_CHANGED> {
  const res = await rawFetch(apiBaseUrl, REFRESH_MUTATION, {
    input: { refreshToken },
  });
  const currentTokens = await loadTokensOrNull();
  // Only apply refresh results to the same session that initiated them.
  if (!currentTokens || currentTokens.refreshToken !== refreshToken) {
    return SESSION_CHANGED;
  }
  const tokens = extractRefreshedAuthTokens(res);
  if (!tokens) return null;
  const expiresAt = tokens.expiresAt ?? fallbackAccessTokenExpiresAt();
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
  onTokensChanged?: OnTokensChanged,
  getAuthStatus?: GetAuthStatus,
): FetchFunction {
  // Serialize concurrent refresh attempts to avoid race conditions
  let refreshPromise: Promise<RefreshResult> | null = null;
  let forcedLogoutPromise: Promise<void> | null = null;
  const isSessionInactive = () => getAuthStatus?.() === 'unauthenticated';

  const performForcedLogout = async (failedRefreshToken: string | null) => {
    if (forcedLogoutPromise) {
      await forcedLogoutPromise;
      return;
    }

    forcedLogoutPromise = (async () => {
      if (failedRefreshToken !== null) {
        // Only force logout if storage still holds the same refresh token that
        // failed — a newer session that signed in while the old refresh was in
        // flight must not be cleared.
        try {
          const remainingTokens = await loadTokens();
          // Skip if: (a) tokens were already cleared by a concurrent logout, or
          // (b) the stored refresh token belongs to a newer session that signed
          //     in while this stale refresh was still in flight.
          if (!remainingTokens || remainingTokens.refreshToken !== failedRefreshToken) return;
        } catch {
          // Fall through and still force the in-memory logout state if storage reads fail.
        }
      }

      try {
        await clearTokens();
      } catch {
        // Keep the app in an unauthenticated state even if SecureStore deletion fails.
      } finally {
        await onForcedLogout();
      }
    })().finally(() => {
      forcedLogoutPromise = null;
    });

    await forcedLogoutPromise;
  };

  return async (operation, variables) => {
    // Once the app has transitioned to a local signed-out state, ignore any
    // persisted tokens that may still be present after a failed storage clear.
    const tokens = isSessionInactive() ? null : await loadTokensOrNull();
    const response = await rawFetch(apiBaseUrl, operation.text ?? '', variables, tokens?.accessToken);
    const authError = hasUnauthenticatedError(response);

    if (isSessionInactive()) {
      return response;
    }

    if (!authError || !tokens?.refreshToken) {
      // If auth error with no refresh token, force logout unconditionally
      if (authError) {
        await performForcedLogout(null);
      }
      return response;
    }

    // Claim the refresh lock before any await so concurrent failures cannot
    // race past the guard and start multiple refresh attempts.
    let currentRefreshPromise = refreshPromise;

    if (!currentRefreshPromise) {
      // Resolve the shared promise with the latest usable token pair once the
      // refresh path finishes, while the first caller can still return a sibling
      // retry response directly when it succeeds.
      let resolveRefreshPromise!: (value: RefreshResult) => void;
      currentRefreshPromise = new Promise<RefreshResult>((resolve) => {
        resolveRefreshPromise = resolve;
      }).finally(() => {
        if (refreshPromise === currentRefreshPromise) {
          refreshPromise = null;
        }
      });
      refreshPromise = currentRefreshPromise;

      try {
        // Re-read storage so a sibling request that already refreshed the session
        // can supply the latest token pair instead of reusing a rotated refresh token.
        if (isSessionInactive()) {
          resolveRefreshPromise(SESSION_INACTIVE);
          return response;
        }

        const latestTokens = await loadTokens();
        if (isSessionInactive()) {
          resolveRefreshPromise(SESSION_INACTIVE);
          return response;
        }

        if (!latestTokens?.refreshToken) {
          resolveRefreshPromise(SESSION_CHANGED);
          return response;
        }

        if (latestTokens?.accessToken && latestTokens.accessToken !== tokens.accessToken) {
          const retryResponse = await rawFetch(
            apiBaseUrl,
            operation.text ?? '',
            variables,
            latestTokens.accessToken,
          );

          if (!hasUnauthenticatedError(retryResponse)) {
            await onTokensChanged?.(latestTokens);
            resolveRefreshPromise(latestTokens);
            return retryResponse;
          }
        }

        const refreshToken = latestTokens.refreshToken;
        const refreshedTokens = await attemptRefresh(apiBaseUrl, refreshToken);
        if (isSessionInactive()) {
          resolveRefreshPromise(SESSION_INACTIVE);
          return response;
        }

        if (refreshedTokens === SESSION_CHANGED) {
          resolveRefreshPromise(SESSION_CHANGED);
        } else if (refreshedTokens) {
          await onTokensChanged?.(refreshedTokens);
          resolveRefreshPromise(refreshedTokens);
        } else {
          // Refresh token was rejected by the server — record which token failed
          // so that performForcedLogout can scope the logout to this session only.
          resolveRefreshPromise(makeRefreshFailed(refreshToken));
        }
      } catch {
        resolveRefreshPromise(TRANSIENT_REFRESH_FAILURE);
        return response;
      }
    }
    const newTokens = await currentRefreshPromise;

    if (
      newTokens === SESSION_INACTIVE ||
      newTokens === SESSION_CHANGED ||
      newTokens === TRANSIENT_REFRESH_FAILURE
    ) {
      return response;
    }

    if (isRefreshFailed(newTokens)) {
      // Pass the refresh token that failed so logout is scoped to this session
      // and cannot clear a newer session that signed in while this refresh was failing.
      await performForcedLogout(newTokens.refreshToken);
      return response;
    }

    // Retry the original request with new tokens
    return rawFetch(apiBaseUrl, operation.text ?? '', variables, newTokens.accessToken);
  };
}
