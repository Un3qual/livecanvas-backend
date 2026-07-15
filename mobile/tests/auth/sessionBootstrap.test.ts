import { describe, expect, vi, test } from 'vitest';

import type { AuthTokenPair } from '../../src/auth/types';
import { REFRESH_MUTATION } from '../../src/auth/authenticatedFetchHelpers';
import { restoreStoredSession } from '../../src/auth/sessionBootstrap';

type TestFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Response | Promise<Response>;

function returnUndefined(): undefined {
  return undefined;
}

describe('restoreStoredSession', () => {
  test('refreshes stored tokens with refreshAuthTokens and stores the rotated pair', async () => {
    const storedTokens: AuthTokenPair = {
      accessToken: 'expired-access-token',
      refreshToken: 'stored-refresh-token',
      expiresAt: '2000-01-01T00:00:00.000Z',
    };
    const refreshedTokens: AuthTokenPair = {
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
      expiresAt: '2026-05-02T00:00:00.000Z',
    };
    const fetchImpl = vi.fn<TestFetch>((_url, _init) =>
      new Response(
        JSON.stringify({
          data: {
            refreshAuthTokens: {
              accessToken: {
                serializedValue: refreshedTokens.accessToken,
                expiresAt: refreshedTokens.expiresAt,
              },
              refreshToken: {
                serializedValue: refreshedTokens.refreshToken,
              },
              errors: [],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const storeTokens = vi.fn(returnUndefined);
    const clearTokens = vi.fn(returnUndefined);

    const state = await restoreStoredSession('http://localhost:4000', {
      readTokens: () => storedTokens,
      storeTokens,
      clearTokens,
      fetchImpl,
    });

    expect(state).toEqual({
      status: 'authenticated',
      tokens: refreshedTokens,
    });
    expect(storeTokens).toHaveBeenCalledWith(refreshedTokens);
    expect(clearTokens).toHaveBeenCalledTimes(0);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:4000/graphql');
    expect((init as RequestInit).headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: REFRESH_MUTATION,
      variables: { input: { refreshToken: storedTokens.refreshToken } },
    });
  });

  test('clears stored tokens when refreshAuthTokens rejects the session', async () => {
    const fetchImpl = vi.fn(() =>
      new Response(
        JSON.stringify({
          data: {
            refreshAuthTokens: {
              accessToken: null,
              refreshToken: null,
              errors: [
                {
                  field: 'refreshToken',
                  message: 'revoked_token',
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const clearTokens = vi.fn(returnUndefined);

    const state = await restoreStoredSession('http://localhost:4000', {
      readTokens: () => ({
        accessToken: 'expired-access-token',
        refreshToken: 'revoked-refresh-token',
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
      storeTokens: () => {
        throw new Error('store should not run');
      },
      clearTokens,
      fetchImpl,
    });

    expect(state).toEqual({ status: 'unauthenticated' });
    expect(clearTokens).toHaveBeenCalledTimes(1);
  });

  test('preserves stored tokens when refreshAuthTokens fails transiently', async () => {
    const storedTokens: AuthTokenPair = {
      accessToken: 'expired-access-token',
      refreshToken: 'stored-refresh-token',
      expiresAt: '2000-01-01T00:00:00.000Z',
    };
    const cases: Array<{
      name: string;
      fetchImpl: TestFetch;
    }> = [
      {
        name: 'transport error',
        fetchImpl: vi.fn(() => {
          throw new Error('offline');
        }),
      },
      {
        name: 'HTTP 503',
        fetchImpl: vi.fn(() => new Response('unavailable', { status: 503 })),
      },
      {
        name: 'invalid JSON',
        fetchImpl: vi.fn(
          () =>
            new Response('not json', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      },
      {
        name: 'malformed response',
        fetchImpl: vi.fn(
          () =>
            new Response(JSON.stringify({ data: { refreshAuthTokens: null } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      },
    ];

    for (const { name, fetchImpl } of cases) {
      const storeTokens = vi.fn(returnUndefined);
      const clearTokens = vi.fn(returnUndefined);

      const state = await restoreStoredSession('http://localhost:4000', {
        readTokens: () => storedTokens,
        storeTokens,
        clearTokens,
        fetchImpl,
      });

      expect(state, name).toEqual({
        status: 'authenticated',
        tokens: storedTokens,
      });
      expect(storeTokens, name).toHaveBeenCalledTimes(0);
      expect(clearTokens, name).toHaveBeenCalledTimes(0);
    }
  });

  test('does not call the network when no stored tokens exist', async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('network should not run');
    });

    await expect(
      restoreStoredSession('http://localhost:4000', {
        readTokens: () => null,
        storeTokens: returnUndefined,
        clearTokens: returnUndefined,
        fetchImpl,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' });
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });

  test('falls back to unauthenticated when token storage read fails', async () => {
    await expect(
      restoreStoredSession('http://localhost:4000', {
        readTokens: () => {
          throw new Error('secure store unavailable');
        },
        storeTokens: returnUndefined,
        clearTokens: returnUndefined,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' });
  });
});
