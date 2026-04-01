import { afterEach, describe, expect, mock, test } from 'bun:test';

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown) {
  return {
    json: async () => payload,
  } as Response;
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }

  throw new Error(`Timed out waiting for ${label}`);
}

afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

describe('createAuthenticatedFetch', () => {
  test('reuses the latest stored session after a sibling request rotates tokens', async () => {
    const initialTokens = {
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token-v1',
      expiresAt: '2026-04-01T00:00:00.000Z',
    };
    const rotatedTokens = {
      accessToken: 'fresh-access-token',
      refreshToken: 'refresh-token-v2',
      expiresAt: '2026-04-15T00:00:00.000Z',
    };
    const rotatedAgainTokens = {
      accessToken: 'fresh-access-token-v2',
      refreshToken: 'refresh-token-v3',
      expiresAt: '2026-04-29T00:00:00.000Z',
    };

    let storedTokens = initialTokens;
    const loadTokens = mock(async () => storedTokens);
    const storeTokens = mock(async (pair) => {
      storedTokens = pair;
    });
    const clearTokens = mock(async () => {
      storedTokens = null as typeof storedTokens;
    });

    mock.module('./tokenStorage', () => ({
      loadTokens,
      storeTokens,
      clearTokens,
    }));

    const { createAuthenticatedFetch } = await import('./authenticatedFetch');

    const deferredRefresh = Promise.withResolvers<Response>();
    const deferredSecondOriginal = Promise.withResolvers<Response>();
    const refreshTokensUsed: string[] = [];
    let staleAccessRequests = 0;

    globalThis.fetch = mock(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? null;
      const query = String(request.query);

      if (query.includes('mutation RefreshAuthTokens')) {
        const refreshToken = String(request.variables.input.refreshToken);
        refreshTokensUsed.push(refreshToken);

        if (refreshToken === initialTokens.refreshToken) {
          if (refreshTokensUsed.length === 1) {
            return deferredRefresh.promise;
          }

          return jsonResponse({
            data: {
              refreshAuthTokens: {
                accessToken: null,
                refreshToken: null,
                errors: [{ field: 'refreshToken', message: 'revoked_token' }],
              },
            },
          });
        }

        if (refreshToken === rotatedTokens.refreshToken) {
          return jsonResponse({
            data: {
              refreshAuthTokens: {
                accessToken: { serializedValue: rotatedAgainTokens.accessToken },
                refreshToken: { serializedValue: rotatedAgainTokens.refreshToken },
                errors: [],
              },
            },
          });
        }

        throw new Error(`unexpected refresh token ${refreshToken}`);
      }

      if (authHeader === `Bearer ${initialTokens.accessToken}`) {
        staleAccessRequests += 1;

        if (staleAccessRequests === 1) {
          return jsonResponse({ errors: [{ message: 'unauthenticated' }] });
        }

        return deferredSecondOriginal.promise;
      }

      if (
        authHeader === `Bearer ${rotatedTokens.accessToken}` ||
        authHeader === `Bearer ${rotatedAgainTokens.accessToken}`
      ) {
        return jsonResponse({ data: { viewer: { id: 'viewer-1' } } });
      }

      throw new Error(`unexpected auth header ${authHeader}`);
    }) as typeof globalThis.fetch;

    const onForcedLogout = mock(() => {});
    const fetchFn = createAuthenticatedFetch('https://api.example.com', onForcedLogout);
    const operation = { text: 'query ViewerQuery { viewer { id } }' } as Parameters<
      ReturnType<typeof createAuthenticatedFetch>
    >[0];

    const firstRequest = fetchFn(operation, {});
    await waitFor(() => refreshTokensUsed.length === 1, 'first refresh attempt');

    const secondRequest = fetchFn(operation, {});
    await waitFor(() => staleAccessRequests === 2, 'second stale request');

    deferredRefresh.resolve(
      jsonResponse({
        data: {
          refreshAuthTokens: {
            accessToken: { serializedValue: rotatedTokens.accessToken },
            refreshToken: { serializedValue: rotatedTokens.refreshToken },
            errors: [],
          },
        },
      }),
    );

    await expect(firstRequest).resolves.toEqual({
      data: { viewer: { id: 'viewer-1' } },
    });

    deferredSecondOriginal.resolve(jsonResponse({ errors: [{ message: 'unauthenticated' }] }));

    await expect(secondRequest).resolves.toEqual({
      data: { viewer: { id: 'viewer-1' } },
    });
    expect(onForcedLogout).not.toHaveBeenCalled();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(refreshTokensUsed).not.toEqual([
      initialTokens.refreshToken,
      initialTokens.refreshToken,
    ]);
  });
});
