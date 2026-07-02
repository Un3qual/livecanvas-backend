import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { AuthState } from '../../src/auth/types';
import type { AppEnvironment } from '../../src/config/environment';
import type { StartupSnapshot } from '../../src/config/runtime';
import type { DiagnosticsProbeStatus } from '../../src/diagnostics/releaseDiagnosticsPresentation';
import {
  createReleaseDiagnosticsScreenModel,
  type ReleaseDiagnosticsScreenModelInput,
} from '../../src/diagnostics/releaseDiagnosticsScreenModel';
import { ReleaseDiagnosticsScreen } from '../../src/diagnostics/ReleaseDiagnosticsScreen';

const API_PROBE_TIMEOUT_MS = 5_000;
const WEBSOCKET_PROBE_TIMEOUT_MS = 3_000;

type StartupState = {
  environment: AppEnvironment;
  snapshot: StartupSnapshot;
};

let mockAuthStatus: AuthState['status'];
let mockStartupState: StartupState;
let mockApiProbeResult: DiagnosticsProbeStatus;
let mockApiProbeError: Error | null;
let mockWebsocketProbeResult: DiagnosticsProbeStatus;
let mockWebsocketProbeError: Error | null;
let mockApiProbeCalls: string[];
let mockWebsocketProbeCalls: Array<{ token: string | null; url: string }>;

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    getAccessToken: () => 'diagnostic-access-token',
    state: { status: mockAuthStatus },
  }),
}));

jest.mock('../../src/providers/StartupGate', () => ({
  useStartupState: () => mockStartupState,
}));

jest.mock('../../src/diagnostics/releaseDiagnosticsProbes', () => ({
  API_PROBE_TIMEOUT_MS,
  runApiReachabilityProbe: ({ apiBaseUrl }: { apiBaseUrl: string }) => {
    mockApiProbeCalls.push(apiBaseUrl);
    return mockApiProbeError
      ? Promise.reject(mockApiProbeError)
      : Promise.resolve(mockApiProbeResult);
  },
  runWebsocketReachabilityProbe: ({
    getAccessToken,
    websocketUrl,
  }: {
    getAccessToken: () => string | null;
    websocketUrl: string;
  }) => {
    mockWebsocketProbeCalls.push({
      token: getAccessToken(),
      url: websocketUrl,
    });
    return mockWebsocketProbeError
      ? Promise.reject(mockWebsocketProbeError)
      : Promise.resolve(mockWebsocketProbeResult);
  },
  WEBSOCKET_PROBE_TIMEOUT_MS,
}));

beforeEach(() => {
  mockAuthStatus = 'authenticated';
  mockStartupState = screenModelInput();
  mockApiProbeResult = { status: 'reachable' };
  mockApiProbeError = null;
  mockWebsocketProbeResult = {
    status: 'failed',
    reason: 'Websocket connection failed',
  };
  mockWebsocketProbeError = null;
  mockApiProbeCalls = [];
  mockWebsocketProbeCalls = [];
});

describe('ReleaseDiagnosticsScreen model', () => {
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

describe('ReleaseDiagnosticsScreen with React Native Testing Library', () => {
  test('renders diagnostics while signed in from startup and auth providers', async () => {
    await render(<ReleaseDiagnosticsScreen />);

    expect(screen.getByText('Runtime checks')).toBeOnTheScreen();
    expect(screen.getByText('Endpoint configuration')).toBeOnTheScreen();
    expect(screen.getByText('Startup snapshot')).toBeOnTheScreen();
    expect(screen.getByText('Reachability probes')).toBeOnTheScreen();
    expect(screen.getAllByText('Authenticated')).toHaveLength(2);
    expect(
      screen.getByText('https://preview-api.livecanvas.example'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('wss://preview-ws.livecanvas.example/socket'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Check API' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Check websocket' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/secret-access-token/)).toBeNull();
    expect(screen.queryByText(/secret-refresh-token/)).toBeNull();
  });

  test('runs API and websocket probes from screen buttons and renders results', async () => {
    const user = userEvent.setup();

    await render(<ReleaseDiagnosticsScreen />);

    await user.press(screen.getByRole('button', { name: 'Check API' }));
    await user.press(screen.getByRole('button', { name: 'Check websocket' }));

    expect(mockApiProbeCalls).toEqual([
      'https://preview-api.livecanvas.example',
    ]);
    expect(mockWebsocketProbeCalls).toEqual([
      {
        token: 'diagnostic-access-token',
        url: 'wss://preview-ws.livecanvas.example/socket',
      },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Reachable')).toBeOnTheScreen();
    });
    await waitFor(() => {
      expect(
        screen.getByText('Failed: Websocket connection failed'),
      ).toBeOnTheScreen();
    });
  });

  test('renders a failed websocket probe when the diagnostic rejects', async () => {
    const user = userEvent.setup();

    mockWebsocketProbeError = new Error(
      'socket internal failure with secret token',
    );

    await render(<ReleaseDiagnosticsScreen />);

    await user.press(screen.getByRole('button', { name: 'Check websocket' }));

    await waitFor(() => {
      expect(screen.getByText('Failed: Websocket probe failed')).toBeOnTheScreen();
    });
    expect(screen.queryByText(/secret token/)).toBeNull();
  });

  test('renders a failed API probe when the diagnostic rejects', async () => {
    const user = userEvent.setup();

    mockApiProbeError = new Error('API internal failure with secret token');

    await render(<ReleaseDiagnosticsScreen />);

    await user.press(screen.getByRole('button', { name: 'Check API' }));

    await waitFor(() => {
      expect(screen.getByText('Failed: API probe failed')).toBeOnTheScreen();
    });
    expect(screen.queryByText(/secret token/)).toBeNull();
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
