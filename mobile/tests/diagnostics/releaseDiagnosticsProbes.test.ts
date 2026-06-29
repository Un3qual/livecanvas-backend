import { describe, expect, test } from 'bun:test';

import {
  API_PROBE_TIMEOUT_MS,
  WEBSOCKET_PROBE_TIMEOUT_MS,
  runApiReachabilityProbe,
  runWebsocketReachabilityProbe,
  type ReleaseDiagnosticsWebSocket,
} from '../../src/diagnostics/releaseDiagnosticsProbes';

describe('release diagnostics probes', () => {
  test('API probe posts a minimal GraphQL payload without auth headers', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    const result = await runApiReachabilityProbe({
      apiBaseUrl: 'https://preview-api.livecanvas.example',
      fetchImpl: async (url, init = {}) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            errors: [{ message: 'unauthenticated' }],
          }),
          { status: 200 },
        );
      },
    });

    expect(result).toEqual({ status: 'reachable' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://preview-api.livecanvas.example/graphql',
    );
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      query: 'query ReleaseDiagnosticsProbe { __typename }',
      variables: {},
    });
  });

  test('API probe reports viewer-safe transport and parse failures', async () => {
    await expect(
      runApiReachabilityProbe({
        apiBaseUrl: 'https://preview-api.livecanvas.example',
        fetchImpl: async () => new Response('down', { status: 503 }),
      }),
    ).resolves.toEqual({
      status: 'failed',
      reason: 'HTTP 503 transport failure',
    });

    await expect(
      runApiReachabilityProbe({
        apiBaseUrl: 'https://preview-api.livecanvas.example',
        fetchImpl: async () => new Response('not json', { status: 200 }),
      }),
    ).resolves.toEqual({
      status: 'failed',
      reason: 'GraphQL response was not valid JSON',
    });

    await expect(
      runApiReachabilityProbe({
        apiBaseUrl: 'https://preview-api.livecanvas.example',
        fetchImpl: async () => {
          throw new Error('secret token abc123 leaked by transport');
        },
      }),
    ).resolves.toEqual({
      status: 'failed',
      reason: 'Network request failed',
    });
  });

  test('websocket probe validates URL shape before opening a socket', async () => {
    let factoryCalled = false;

    await expect(
      runWebsocketReachabilityProbe({
        websocketUrl: 'https://preview-ws.livecanvas.example/socket',
        createWebSocket: () => {
          factoryCalled = true;
          throw new Error('should not be called');
        },
      }),
    ).resolves.toEqual({
      status: 'failed',
      reason: 'Websocket URL must start with ws:// or wss://',
    });

    expect(factoryCalled).toBe(false);
  });

  test('websocket probe opens and immediately closes a short-lived socket', async () => {
    let closeCalled = false;

    const result = await runWebsocketReachabilityProbe({
      websocketUrl: 'wss://preview-ws.livecanvas.example/socket',
      createWebSocket: () => {
        const socket: ReleaseDiagnosticsWebSocket = {
          close: () => {
            closeCalled = true;
          },
          onclose: null,
          onerror: null,
          onopen: null,
        };

        queueMicrotask(() => {
          socket.onopen?.();
        });

        return socket;
      },
    });

    expect(result).toEqual({ status: 'reachable' });
    expect(closeCalled).toBe(true);
  });

  test('websocket probe reports viewer-safe open failures', async () => {
    const result = await runWebsocketReachabilityProbe({
      websocketUrl: 'wss://preview-ws.livecanvas.example/socket',
      createWebSocket: () => {
        const socket: ReleaseDiagnosticsWebSocket = {
          close: () => undefined,
          onclose: null,
          onerror: null,
          onopen: null,
        };

        queueMicrotask(() => {
          socket.onerror?.();
        });

        return socket;
      },
    });

    expect(result).toEqual({
      status: 'failed',
      reason: 'Websocket connection failed',
    });
  });

  test('probe timeouts are named and short', () => {
    expect(API_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
    expect(WEBSOCKET_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(3_000);
  });
});
