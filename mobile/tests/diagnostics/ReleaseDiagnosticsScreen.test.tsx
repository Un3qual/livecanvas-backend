import { describe, expect, mock, test } from 'bun:test';

import type { ReleaseDiagnosticsScreenModelInput } from '../../src/diagnostics/ReleaseDiagnosticsScreen';

function NullComponent() {
  return null;
}

mock.module('react-native', () => ({
  Pressable: NullComponent,
  ScrollView: NullComponent,
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Text: NullComponent,
  View: NullComponent,
}));
mock.module('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authenticated' } }),
}));
mock.module('../../src/components/AppButton', () => ({ AppButton: NullComponent }));
mock.module('../../src/components/AppCard', () => ({ AppCard: NullComponent }));
mock.module('../../src/components/AppHeader', () => ({ AppHeader: NullComponent }));
mock.module('../../src/providers/StartupGate', () => ({
  useStartupState: () => ({
    environment: {
      apiBaseUrl: 'https://preview-api.livecanvas.example',
      bootSessionState: 'authenticated',
      websocketUrl: 'wss://preview-ws.livecanvas.example/socket',
    },
    snapshot: {
      bootSessionState: 'authenticated',
      defaultHref: '/home',
      initialHref: '/diagnostics',
      initialUrl: 'livecanvas-mobile://diagnostics',
      landingHref: '/diagnostics',
      resetReason: null,
    },
  }),
}));
mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: 'accent',
      background: 'background',
      surfaceMuted: 'surfaceMuted',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));

const screenModule = await import('../../src/diagnostics/ReleaseDiagnosticsScreen');
const routeModule = await import('../../app/(app)/diagnostics');
const { createReleaseDiagnosticsScreenModel } = screenModule;

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

  test('diagnostics route exposes the signed-in diagnostics screen', () => {
    expect(typeof routeModule.default).toBe('function');
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
      initialHref: '/diagnostics',
      initialUrl: 'livecanvas-mobile://diagnostics',
      landingHref: '/diagnostics',
      resetReason: null,
    },
    websocketProbeStatus: { status: 'idle' },
    ...overrides,
  };
}
