import { describe, expect, test } from 'bun:test';

import {
  createReleaseDiagnosticsScreenModel,
  type ReleaseDiagnosticsScreenModelInput,
} from '../../src/diagnostics/releaseDiagnosticsScreenModel';

describe('ReleaseDiagnosticsScreen', () => {
  test('builds an operator-facing runtime snapshot without token-bearing auth data', () => {
    const model = createReleaseDiagnosticsScreenModel(screenModelInput());

    expect(model.endpointRows).toEqual([
      {
        badge: 'Configured endpoint',
        label: 'API URL',
        value: 'https://preview-api.livecanvas.example',
        warning: null,
      },
      {
        badge: 'Configured endpoint',
        label: 'Websocket URL',
        value: 'wss://preview-ws.livecanvas.example/socket',
        warning: null,
      },
    ]);
    expect(model.stateRows).toEqual([
      { label: 'Boot session', value: 'Authenticated' },
      { label: 'Current auth', value: 'Authenticated' },
      { label: 'Initial URL', value: 'livecanvas-mobile://diagnostics' },
      { label: 'Initial href', value: '/diagnostics' },
      { label: 'Landing href', value: '/diagnostics' },
      { label: 'Default href', value: '/home' },
      { label: 'Reset reason', value: 'None' },
    ]);
    expect(JSON.stringify(model)).not.toContain('secret-access-token');
    expect(JSON.stringify(model)).not.toContain('secret-refresh-token');
    expect(JSON.stringify(model)).not.toContain('secret-fragment');
  });

  test('shows separate API and websocket probe actions and results', () => {
    const model = createReleaseDiagnosticsScreenModel(
      screenModelInput({
        apiProbeStatus: { status: 'reachable' },
        websocketProbeStatus: {
          status: 'failed',
          reason: 'Websocket connection failed',
        },
      }),
    );

    expect(model.probeRows).toEqual([
      {
        actionLabel: 'Check API',
        disabled: false,
        label: 'API probe',
        statusLabel: 'Reachable',
      },
      {
        actionLabel: 'Check websocket',
        disabled: false,
        label: 'Websocket probe',
        statusLabel: 'Failed: Websocket connection failed',
      },
    ]);
  });
});

function screenModelInput(
  overrides: Partial<ReleaseDiagnosticsScreenModelInput> = {},
): ReleaseDiagnosticsScreenModelInput {
  return {
    apiProbeStatus: { status: 'idle' },
    authStatus: 'authenticated',
    environment: {
      apiBaseUrl: 'https://preview-api.livecanvas.example',
      bootSessionState: 'authenticated',
      websocketUrl: 'wss://preview-ws.livecanvas.example/socket',
    },
    snapshot: {
      bootSessionState: 'authenticated',
      defaultHref: '/home',
      initialHref:
        '/diagnostics?refresh_token=secret-refresh-token#secret-fragment',
      initialUrl:
        'livecanvas-mobile://diagnostics?access_token=secret-access-token#secret-fragment',
      landingHref: '/diagnostics',
      resetReason: null,
    },
    websocketProbeStatus: { status: 'idle' },
    ...overrides,
  };
}
