import { afterEach, describe, expect, mock, test } from 'bun:test';

const originalFetch = globalThis.fetch;

afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

describe('createBasicFetch', () => {
  test('falls back to an empty query string when Relay operation text is unavailable', async () => {
    mock.module('relay-runtime', () => ({
      Environment: class Environment {},
      Network: { create: (fetchFn: unknown) => fetchFn },
      RecordSource: class RecordSource {},
      Store: class Store {},
    }));

    const { createBasicFetch } = await import('../../src/relay/environment');

    globalThis.fetch = mock(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        query: '',
        variables: { id: 'viewer-1' },
      });

      return new Response(JSON.stringify({ data: { viewer: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;

    const fetchFn = createBasicFetch('https://api.example.com');

    await expect(
      fetchFn({ text: undefined } as Parameters<ReturnType<typeof createBasicFetch>>[0], {
        id: 'viewer-1',
      }),
    ).resolves.toEqual({ data: { viewer: null } });
  });

  test('throws a descriptive HTTP error for non-JSON transport failures', async () => {
    mock.module('relay-runtime', () => ({
      Environment: class Environment {},
      Network: { create: (fetchFn: unknown) => fetchFn },
      RecordSource: class RecordSource {},
      Store: class Store {},
    }));

    const { createBasicFetch } = await import('../../src/relay/environment');

    globalThis.fetch = mock(async () => {
      return new Response('<html>bad gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      });
    }) as typeof globalThis.fetch;

    const fetchFn = createBasicFetch('https://api.example.com');

    await expect(
      fetchFn({ text: 'query ViewerQuery { viewer { id } }' } as Parameters<
        ReturnType<typeof createBasicFetch>
      >[0], {}),
    ).rejects.toThrow('GraphQL request failed with 502 Bad Gateway');
  });

  test('returns JSON GraphQL errors from non-2xx responses', async () => {
    mock.module('relay-runtime', () => ({
      Environment: class Environment {},
      Network: { create: (fetchFn: unknown) => fetchFn },
      RecordSource: class RecordSource {},
      Store: class Store {},
    }));

    const { createBasicFetch } = await import('../../src/relay/environment');

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ errors: [{ message: 'unauthenticated' }] }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;

    const fetchFn = createBasicFetch('https://api.example.com');

    await expect(
      fetchFn({ text: 'query ViewerQuery { viewer { id } }' } as Parameters<
        ReturnType<typeof createBasicFetch>
      >[0], {}),
    ).resolves.toEqual({ errors: [{ message: 'unauthenticated' }] });
  });
});
