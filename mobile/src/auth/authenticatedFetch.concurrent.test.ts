import { afterEach, describe, expect, mock, test } from 'bun:test';

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, init: ResponseInit) {
  return new Response(body, init);
}

async function importAuthenticatedFetchModule() {
  return import(`./authenticatedFetch?test=${crypto.randomUUID()}`);
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
  test('serializes refresh attempts while token storage is still loading', async () => {
    const initialTokens = {
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token-v1',
      expiresAt: '2026-04-01T00:00:00.000Z',
    };
    const refreshedTokens = {
      accessToken: 'fresh-access-token',
      refreshToken: 'refresh-token-v2',
      expiresAt: '2026-04-15T00:00:00.000Z',
    };

    const loadTokensDeferred = Promise.withResolvers<typeof initialTokens | null>();
    let storedTokens = initialTokens;
    const loadTokens = mock(async () => loadTokensDeferred.promise);
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

    const { createAuthenticatedFetch } = await importAuthenticatedFetchModule();

    const refreshResponse = Promise.withResolvers<Response>();
    let refreshCalls = 0;

    globalThis.fetch = mock(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? null;

      if (String(request.query).includes('mutation RefreshAuthTokens')) {
        refreshCalls += 1;
        if (refreshCalls > 1) {
          throw new Error(`unexpected second refresh attempt ${refreshCalls}`);
        }

        return refreshResponse.promise;
      }

      if (authHeader === `Bearer ${initialTokens.accessToken}`) {
        return jsonResponse({ errors: [{ message: 'unauthenticated' }] });
      }

      if (authHeader === `Bearer ${refreshedTokens.accessToken}`) {
        return jsonResponse({ data: { viewer: { id: 'viewer-1' } } });
      }

      throw new Error(`unexpected auth header ${authHeader}`);
    }) as typeof globalThis.fetch;

    const onForcedLogout = mock(() => {});
    const onTokensChanged = mock(() => {});
    const fetchFn = createAuthenticatedFetch(
      'https://api.example.com',
      onForcedLogout,
      onTokensChanged,
    );
    const operation = { text: 'query ViewerQuery { viewer { id } }' } as Parameters<
      ReturnType<typeof createAuthenticatedFetch>
    >[0];

    const firstRequest = fetchFn(operation, {});
    const secondRequest = fetchFn(operation, {});

    loadTokensDeferred.resolve(storedTokens);

    await waitFor(() => refreshCalls === 1, 'one refresh attempt');

    refreshResponse.resolve(
      jsonResponse({
        data: {
          refreshAuthTokens: {
            accessToken: {
              serializedValue: refreshedTokens.accessToken,
              expiresAt: refreshedTokens.expiresAt,
            },
            refreshToken: { serializedValue: refreshedTokens.refreshToken },
            errors: [],
          },
        },
      }),
    );

    await expect(firstRequest).resolves.toEqual({
      data: { viewer: { id: 'viewer-1' } },
    });
    await expect(secondRequest).resolves.toEqual({
      data: { viewer: { id: 'viewer-1' } },
    });

    expect(refreshCalls).toBe(1);
    expect(onForcedLogout).not.toHaveBeenCalled();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(onTokensChanged).toHaveBeenCalledTimes(1);
    expect(onTokensChanged).toHaveBeenCalledWith(refreshedTokens);
  });

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

    const { createAuthenticatedFetch } = await importAuthenticatedFetchModule();

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
          if (refreshTokensUsed.length > 1) {
            throw new Error(`unexpected second refresh attempt ${refreshTokensUsed.length}`);
          }

          return deferredRefresh.promise;
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
        authHeader === `Bearer ${rotatedTokens.accessToken}`
      ) {
        return jsonResponse({ data: { viewer: { id: 'viewer-1' } } });
      }

      throw new Error(`unexpected auth header ${authHeader}`);
    }) as typeof globalThis.fetch;

    const onForcedLogout = mock(() => {});
    const onTokensChanged = mock(() => {});
    const fetchFn = createAuthenticatedFetch(
      'https://api.example.com',
      onForcedLogout,
      onTokensChanged,
    );
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
            accessToken: {
              serializedValue: rotatedTokens.accessToken,
              expiresAt: rotatedTokens.expiresAt,
            },
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
    expect(refreshTokensUsed).toEqual([initialTokens.refreshToken]);
    expect(onTokensChanged).toHaveBeenCalledTimes(2);
    expect(onTokensChanged).toHaveBeenCalledWith(rotatedTokens);
  });

  test('returns the original auth response when refresh fails for transient transport reasons', async () => {
    const initialTokens = {
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token-v1',
      expiresAt: '2026-04-01T00:00:00.000Z',
    };

    const loadTokens = mock(async () => initialTokens);
    const storeTokens = mock(async () => {});
    const clearTokens = mock(async () => {});

    mock.module('./tokenStorage', () => ({
      loadTokens,
      storeTokens,
      clearTokens,
    }));

    const { createAuthenticatedFetch } = await importAuthenticatedFetchModule();

    globalThis.fetch = mock(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? null;

      if (String(request.query).includes('mutation RefreshAuthTokens')) {
        return textResponse('bad gateway', { status: 502, statusText: 'Bad Gateway' });
      }

      if (authHeader === `Bearer ${initialTokens.accessToken}`) {
        return jsonResponse({ errors: [{ message: 'unauthenticated' }] });
      }

      throw new Error(`unexpected auth header ${authHeader}`);
    }) as typeof globalThis.fetch;

    const onForcedLogout = mock(() => {});
    const onTokensChanged = mock(() => {});
    const fetchFn = createAuthenticatedFetch(
      'https://api.example.com',
      onForcedLogout,
      onTokensChanged,
    );
    const operation = { text: 'query ViewerQuery { viewer { id } }' } as Parameters<
      ReturnType<typeof createAuthenticatedFetch>
    >[0];

    await expect(fetchFn(operation, {})).resolves.toEqual({
      errors: [{ message: 'unauthenticated' }],
    });
    expect(storeTokens).not.toHaveBeenCalled();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(onForcedLogout).not.toHaveBeenCalled();
    expect(onTokensChanged).not.toHaveBeenCalled();
  });

  test('forces logout when refresh returns a revoked-token payload error', async () => {
    const initialTokens = {
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token-v1',
      expiresAt: '2026-04-01T00:00:00.000Z',
    };

    const loadTokens = mock(async () => initialTokens);
    const storeTokens = mock(async () => {});
    const clearTokens = mock(async () => {});

    mock.module('./tokenStorage', () => ({
      loadTokens,
      storeTokens,
      clearTokens,
    }));

    const { createAuthenticatedFetch } = await importAuthenticatedFetchModule();

    globalThis.fetch = mock(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? null;

      if (String(request.query).includes('mutation RefreshAuthTokens')) {
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

      if (authHeader === `Bearer ${initialTokens.accessToken}`) {
        return jsonResponse({ errors: [{ message: 'unauthenticated' }] });
      }

      throw new Error(`unexpected auth header ${authHeader}`);
    }) as typeof globalThis.fetch;

    const onForcedLogout = mock(() => {});
    const onTokensChanged = mock(() => {});
    const fetchFn = createAuthenticatedFetch(
      'https://api.example.com',
      onForcedLogout,
      onTokensChanged,
    );
    const operation = { text: 'query ViewerQuery { viewer { id } }' } as Parameters<
      ReturnType<typeof createAuthenticatedFetch>
    >[0];

    await expect(fetchFn(operation, {})).resolves.toEqual({
      errors: [{ message: 'unauthenticated' }],
    });
    expect(storeTokens).not.toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(onForcedLogout).toHaveBeenCalledTimes(1);
    expect(onTokensChanged).not.toHaveBeenCalled();
  });

  test('throws an HTTP error instead of a JSON parse error for non-JSON failures', async () => {
    const loadTokens = mock(async () => null);
    const storeTokens = mock(async () => {});
    const clearTokens = mock(async () => {});

    mock.module('./tokenStorage', () => ({
      loadTokens,
      storeTokens,
      clearTokens,
    }));

    const { createAuthenticatedFetch } = await importAuthenticatedFetchModule();

    globalThis.fetch = mock(async () => {
      return textResponse('<html>bad gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      });
    }) as typeof globalThis.fetch;

    const onForcedLogout = mock(() => {});
    const fetchFn = createAuthenticatedFetch('https://api.example.com', onForcedLogout);
    const operation = { text: 'query ViewerQuery { viewer { id } }' } as Parameters<
      ReturnType<typeof createAuthenticatedFetch>
    >[0];

    await expect(fetchFn(operation, {})).rejects.toThrow('GraphQL request failed with 502 Bad Gateway');
    expect(onForcedLogout).not.toHaveBeenCalled();
  });
});
