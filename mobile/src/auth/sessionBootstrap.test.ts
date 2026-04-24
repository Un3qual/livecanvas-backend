import { describe, expect, mock, test } from 'bun:test';

import type { AuthTokenPair } from './types';
import {
  ISSUE_VIEWER_AUTH_TOKENS_MUTATION,
  resolveSessionBootstrapState,
  restoreStoredSession,
} from './sessionBootstrap';

describe('resolveSessionBootstrapState', () => {
  test('restores authenticated state when stored tokens exist even if the access token is expired', () => {
    const storedTokens: AuthTokenPair = {
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: '2000-01-01T00:00:00.000Z',
    };

    expect(resolveSessionBootstrapState(storedTokens)).toEqual({
      status: 'authenticated',
      tokens: storedTokens,
    });
  });

  test('restores unauthenticated state when no tokens are stored', () => {
    expect(resolveSessionBootstrapState(null)).toEqual({
      status: 'unauthenticated',
    });
  });

  test('validates stored tokens with issueViewerAuthTokens and stores the rotated pair', async () => {
    const storedTokens: AuthTokenPair = {
      accessToken: 'stored-access-token',
      refreshToken: 'stored-refresh-token',
      expiresAt: '2026-05-01T00:00:00.000Z',
    };
    const issuedTokens: AuthTokenPair = {
      accessToken: 'issued-access-token',
      refreshToken: 'issued-refresh-token',
      expiresAt: '2026-05-02T00:00:00.000Z',
    };
    const fetchImpl = mock(async () =>
      new Response(
        JSON.stringify({
          data: {
            issueViewerAuthTokens: {
              accessToken: {
                serializedValue: issuedTokens.accessToken,
                expiresAt: issuedTokens.expiresAt,
              },
              refreshToken: {
                serializedValue: issuedTokens.refreshToken,
              },
              errors: [],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const storeTokens = mock(async (_tokens: AuthTokenPair) => {});
    const clearTokens = mock(async () => {});

    const state = await restoreStoredSession('http://localhost:4000', {
      readTokens: async () => storedTokens,
      storeTokens,
      clearTokens,
      fetchImpl,
    });

    expect(state).toEqual({
      status: 'authenticated',
      tokens: issuedTokens,
    });
    expect(storeTokens).toHaveBeenCalledWith(issuedTokens);
    expect(clearTokens).toHaveBeenCalledTimes(0);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:4000/graphql');
    expect((init as RequestInit).headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer stored-access-token',
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: ISSUE_VIEWER_AUTH_TOKENS_MUTATION,
      variables: { input: {} },
    });
  });

  test('clears stored tokens when issueViewerAuthTokens rejects the session', async () => {
    const fetchImpl = mock(async () =>
      new Response(
        JSON.stringify({
          data: {
            issueViewerAuthTokens: {
              accessToken: null,
              refreshToken: null,
              errors: [
                {
                  field: null,
                  message: 'unauthenticated',
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const clearTokens = mock(async () => {});

    const state = await restoreStoredSession('http://localhost:4000', {
      readTokens: async () => ({
        accessToken: 'expired-access-token',
        refreshToken: 'revoked-refresh-token',
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
      storeTokens: async () => {
        throw new Error('store should not run');
      },
      clearTokens,
      fetchImpl,
    });

    expect(state).toEqual({ status: 'unauthenticated' });
    expect(clearTokens).toHaveBeenCalledTimes(1);
  });

  test('does not call the network when no stored tokens exist', async () => {
    const fetchImpl = mock(async () => {
      throw new Error('network should not run');
    });

    await expect(
      restoreStoredSession('http://localhost:4000', {
        readTokens: async () => null,
        storeTokens: async () => {},
        clearTokens: async () => {},
        fetchImpl,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' });
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });
});
