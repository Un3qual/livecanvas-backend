import type { AuthState, AuthTokenPair } from './types';
import {
  REFRESH_MUTATION,
  buildTokenPair,
  extractRefreshedAuthTokens,
  type GraphQLResponseInput,
} from './authenticatedFetchHelpers';

const ACCESS_TOKEN_TTL_DAYS = 14;
const GRAPHQL_ENDPOINT_PATH = '/graphql';

type FetchImpl = typeof fetch;

type SessionRestoreDependencies = {
  readTokens: () => Promise<AuthTokenPair | null>;
  storeTokens: (tokens: AuthTokenPair) => Promise<void>;
  clearTokens: () => Promise<void>;
  fetchImpl?: FetchImpl;
};

type RefreshRestoreResult =
  | { status: 'refreshed'; tokens: AuthTokenPair }
  | { status: 'rejected' }
  | { status: 'transient_failure' };

// Only these server-authored outcomes prove the persisted refresh token cannot
// restore the session. Network, HTTP, JSON, or malformed response failures keep
// the stored tokens so the app can retry without forcing a permanent logout.
const DEFINITIVE_SESSION_REJECTION_VALUES = new Set([
  'invalid_token',
  'expired_token',
  'revoked_token',
  'unauthenticated',
  'token_expired',
  'token_revoked',
]);

function fallbackAccessTokenExpiresAt(): string {
  return new Date(Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeErrorValue(value: unknown): string | null {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function isDefinitiveSessionRejectionEntry(entry: unknown): boolean {
  if (!isObject(entry)) return false;

  const message = normalizeErrorValue(entry.message);
  if (message && DEFINITIVE_SESSION_REJECTION_VALUES.has(message)) return true;

  const code = normalizeErrorValue(entry.code);
  if (code && DEFINITIVE_SESSION_REJECTION_VALUES.has(code)) return true;

  const extensions = entry.extensions;
  if (!isObject(extensions)) return false;

  const extensionCode = normalizeErrorValue(extensions.code);
  return extensionCode !== null && DEFINITIVE_SESSION_REJECTION_VALUES.has(extensionCode);
}

function payloadHasDefinitiveSessionRejection(value: unknown): boolean {
  if (!isObject(value)) return false;

  const errors = value.errors;
  return Array.isArray(errors) && errors.some(isDefinitiveSessionRejectionEntry);
}

function hasDefinitiveSessionRejection(response: unknown): boolean {
  if (!isObject(response)) return false;

  const errors = response.errors;
  if (Array.isArray(errors) && errors.some(isDefinitiveSessionRejectionEntry)) {
    return true;
  }

  const data = response.data;
  if (!isObject(data)) return false;

  return Object.values(data).some((payload) => {
    if (Array.isArray(payload)) {
      return payload.some(payloadHasDefinitiveSessionRejection);
    }

    return payloadHasDefinitiveSessionRejection(payload);
  });
}

async function clearStoredTokens(clearTokens: () => Promise<void>): Promise<void> {
  try {
    await clearTokens();
  } catch {
    // Session restore must settle into signed-out UI even if SecureStore cleanup fails.
  }
}

async function refreshAuthTokens(
  apiBaseUrl: string,
  refreshToken: string,
  fetchImpl: FetchImpl,
): Promise<RefreshRestoreResult> {
  let response: Response;

  try {
    response = await fetchImpl(`${apiBaseUrl}${GRAPHQL_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: REFRESH_MUTATION,
        variables: {
          input: { refreshToken },
        },
      }),
    });
  } catch {
    return { status: 'transient_failure' };
  }

  if (!response.ok) {
    return { status: 'transient_failure' };
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return { status: 'transient_failure' };
  }

  if (hasDefinitiveSessionRejection(body)) {
    return { status: 'rejected' };
  }

  const refreshedTokens = extractRefreshedAuthTokens(body as GraphQLResponseInput);
  if (!refreshedTokens) {
    return { status: 'transient_failure' };
  }

  return {
    status: 'refreshed',
    tokens: buildTokenPair(
      refreshedTokens.accessToken,
      refreshedTokens.refreshToken,
      refreshedTokens.expiresAt ?? fallbackAccessTokenExpiresAt(),
    ),
  };
}

export async function restoreStoredSession(
  apiBaseUrl: string,
  dependencies: SessionRestoreDependencies,
): Promise<AuthState> {
  let storedTokens: AuthTokenPair | null;

  try {
    storedTokens = await dependencies.readTokens();
  } catch {
    return { status: 'unauthenticated' };
  }

  if (!storedTokens) {
    return { status: 'unauthenticated' };
  }

  const result = await refreshAuthTokens(
    apiBaseUrl,
    storedTokens.refreshToken,
    dependencies.fetchImpl ?? fetch,
  );

  if (result.status === 'transient_failure') {
    // Keep the existing session in memory; authenticated Relay fetches can retry
    // refresh once transport recovers, and storage remains intact for later app starts.
    return {
      status: 'authenticated',
      tokens: storedTokens,
    };
  }

  if (result.status === 'rejected') {
    await clearStoredTokens(dependencies.clearTokens);
    return { status: 'unauthenticated' };
  }

  await dependencies.storeTokens(result.tokens);

  return {
    status: 'authenticated',
    tokens: result.tokens,
  };
}
