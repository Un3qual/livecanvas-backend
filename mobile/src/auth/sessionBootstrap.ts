import type { AuthState, AuthTokenPair } from './types';

const ACCESS_TOKEN_TTL_DAYS = 14;
const GRAPHQL_ENDPOINT_PATH = '/graphql';

type FetchImpl = typeof fetch;

type GraphQLToken = {
  serializedValue?: unknown;
  expiresAt?: unknown;
};

type IssueViewerAuthTokensPayload = {
  accessToken?: GraphQLToken | null;
  refreshToken?: GraphQLToken | null;
  errors?: unknown[] | null;
};

type GraphQLResponse = {
  data?: {
    issueViewerAuthTokens?: IssueViewerAuthTokensPayload | null;
  } | null;
  errors?: unknown[] | null;
};

type SessionRestoreDependencies = {
  readTokens: () => Promise<AuthTokenPair | null>;
  storeTokens: (tokens: AuthTokenPair) => Promise<void>;
  clearTokens: () => Promise<void>;
  fetchImpl?: FetchImpl;
};

export const ISSUE_VIEWER_AUTH_TOKENS_MUTATION = `
  mutation IssueViewerAuthTokens($input: IssueViewerAuthTokensInput!) {
    issueViewerAuthTokens(input: $input) {
      accessToken {
        serializedValue
        expiresAt
      }
      refreshToken {
        serializedValue
      }
      errors {
        field
        message
      }
    }
  }
`;

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

function fallbackAccessTokenExpiresAt(): string {
  return new Date(Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function getTokenValue(token: GraphQLToken | null | undefined): string | null {
  return typeof token?.serializedValue === 'string' ? token.serializedValue : null;
}

function getTokenExpiry(token: GraphQLToken | null | undefined): string | null {
  return typeof token?.expiresAt === 'string' ? token.expiresAt : null;
}

function extractIssuedAuthTokens(response: GraphQLResponse): AuthTokenPair | null {
  if (Array.isArray(response.errors) && response.errors.length > 0) {
    return null;
  }

  const payload = response.data?.issueViewerAuthTokens;
  if (!payload || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
    return null;
  }

  const accessToken = getTokenValue(payload.accessToken);
  const refreshToken = getTokenValue(payload.refreshToken);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: getTokenExpiry(payload.accessToken) ?? fallbackAccessTokenExpiresAt(),
  };
}

async function clearStoredTokens(clearTokens: () => Promise<void>): Promise<void> {
  try {
    await clearTokens();
  } catch {
    // Session restore must settle into signed-out UI even if SecureStore cleanup fails.
  }
}

async function issueViewerAuthTokens(
  apiBaseUrl: string,
  accessToken: string,
  fetchImpl: FetchImpl,
): Promise<AuthTokenPair | null> {
  const response = await fetchImpl(`${apiBaseUrl}${GRAPHQL_ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: ISSUE_VIEWER_AUTH_TOKENS_MUTATION,
      variables: {
        input: {},
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  return extractIssuedAuthTokens((await response.json()) as GraphQLResponse);
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

  try {
    const issuedTokens = await issueViewerAuthTokens(
      apiBaseUrl,
      storedTokens.accessToken,
      dependencies.fetchImpl ?? fetch,
    );

    if (!issuedTokens) {
      await clearStoredTokens(dependencies.clearTokens);
      return { status: 'unauthenticated' };
    }

    await dependencies.storeTokens(issuedTokens);

    return {
      status: 'authenticated',
      tokens: issuedTokens,
    };
  } catch {
    await clearStoredTokens(dependencies.clearTokens);
    return { status: 'unauthenticated' };
  }
}
