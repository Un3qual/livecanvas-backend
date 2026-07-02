import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { RequestParameters } from 'relay-runtime';

const originalFetch = globalThis.fetch;

afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

class MockRelayEnvironment {
  readonly mockName = 'Environment';
}

class MockRelayRecordSource {
  readonly mockName = 'RecordSource';
}

class MockRelayStore {
  readonly mockName = 'Store';
}

function mockRelayRuntime() {
  mock.module('relay-runtime', () => ({
    Environment: MockRelayEnvironment,
    Network: { create: (fetchFn: unknown) => fetchFn },
    RecordSource: MockRelayRecordSource,
    Store: MockRelayStore,
  }));
}

function requestParameters(text: string | null): RequestParameters {
  return {
    cacheID: text ?? 'missing-text',
    id: null,
    metadata: {},
    name: 'ViewerQuery',
    operationKind: 'query',
    text,
  };
}

describe('createBasicFetch', () => {
  test('falls back to an empty query string when Relay operation text is unavailable', async () => {
    mockRelayRuntime();

    const { createBasicFetch } = await import('../../src/relay/environment');

    globalThis.fetch = mock((_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        query: '',
        variables: { id: 'viewer-1' },
      });

      return new Response(JSON.stringify({ data: { viewer: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof globalThis.fetch;

    const fetchFn = createBasicFetch('https://api.example.com');

    await expect(
      fetchFn(
        requestParameters(null),
        {
          id: 'viewer-1',
        },
        {},
      ),
    ).resolves.toEqual({ data: { viewer: null } });
  });

  test('throws a descriptive HTTP error for non-JSON transport failures', async () => {
    mockRelayRuntime();

    const { createBasicFetch } = await import('../../src/relay/environment');

    globalThis.fetch = mock(() => {
      return new Response('<html>bad gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      });
    }) as unknown as typeof globalThis.fetch;

    const fetchFn = createBasicFetch('https://api.example.com');

    await expect(
      fetchFn(
        requestParameters('query ViewerQuery { viewer { id } }'),
        {},
        {},
      ),
    ).rejects.toThrow('GraphQL request failed with 502 Bad Gateway');
  });

  test('returns JSON GraphQL errors from non-2xx responses', async () => {
    mockRelayRuntime();

    const { createBasicFetch } = await import('../../src/relay/environment');

    globalThis.fetch = mock(() => {
      return new Response(JSON.stringify({ errors: [{ message: 'unauthenticated' }] }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof globalThis.fetch;

    const fetchFn = createBasicFetch('https://api.example.com');

    await expect(
      fetchFn(
        requestParameters('query ViewerQuery { viewer { id } }'),
        {},
        {},
      ),
    ).resolves.toEqual({ errors: [{ message: 'unauthenticated' }] });
  });
});
