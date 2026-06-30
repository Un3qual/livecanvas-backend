import {
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';
import {
  Fragment,
  createElement,
  isValidElement,
  type ReactElement,
} from 'react';

import type { AuthState } from '../../src/auth/types';
import type { AppEnvironment } from '../../src/config/environment';
import type { StartupSnapshot } from '../../src/config/runtime';
import type { DiagnosticsProbeStatus } from '../../src/diagnostics/releaseDiagnosticsPresentation';
import type { ReleaseDiagnosticsScreenModelInput } from '../../src/diagnostics/releaseDiagnosticsScreenModel';

const API_PROBE_TIMEOUT_MS = 5_000;
const WEBSOCKET_PROBE_TIMEOUT_MS = 3_000;

type StartupState = {
  environment: AppEnvironment;
  snapshot: StartupSnapshot;
};

type HostNode = {
  children: RenderedTree[];
  props: Record<string, unknown>;
  type: string;
};

type RenderedTree = HostNode | string | null | readonly RenderedTree[];

type HookDispatcher = {
  useState: <State>(
    initialState: State | (() => State),
  ) => [State, (nextState: State | ((current: State) => State)) => void];
};

const reactInternals = (
  await import('react')
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as {
  H: HookDispatcher | null;
};

let authStatus: AuthState['status'];
let startupState: StartupState;
let apiProbeResult: DiagnosticsProbeStatus;
let websocketProbeResult: DiagnosticsProbeStatus;
let websocketProbeError: Error | null;
let hookStates: unknown[];
let hookIndex = 0;
let apiProbeCalls: string[];
let websocketProbeCalls: Array<{ token: string | null; url: string }>;

function nativeHost(name: string) {
  return name;
}

mock.module('react-native', () => ({
  Pressable: nativeHost('Pressable'),
  ScrollView: nativeHost('ScrollView'),
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
  },
  Text: nativeHost('Text'),
  View: nativeHost('View'),
}));

mock.module('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    getAccessToken: () => 'diagnostic-access-token',
    state: { status: authStatus },
  }),
}));

mock.module('../../src/providers/StartupGate', () => ({
  useStartupState: () => startupState,
}));

mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: 'accent',
      accentText: 'accentText',
      background: 'background',
      border: 'border',
      error: 'error',
      errorMuted: 'errorMuted',
      surface: 'surface',
      surfaceMuted: 'surfaceMuted',
      text: 'text',
      textMuted: 'textMuted',
    },
    radius: { lg: 16, md: 12, pill: 999, sm: 8 },
    spacing: { lg: 16, md: 12, sm: 8, xl: 24, xs: 4 },
  }),
}));

mock.module('../../src/diagnostics/releaseDiagnosticsProbes', () => ({
  API_PROBE_TIMEOUT_MS,
  runApiReachabilityProbe: ({ apiBaseUrl }: { apiBaseUrl: string }) => {
    apiProbeCalls.push(apiBaseUrl);
    return Promise.resolve(apiProbeResult);
  },
  runWebsocketReachabilityProbe: ({
    getAccessToken,
    websocketUrl,
  }: {
    getAccessToken: () => string | null;
    websocketUrl: string;
  }) => {
    websocketProbeCalls.push({
      token: getAccessToken(),
      url: websocketUrl,
    });
    return websocketProbeError
      ? Promise.reject(websocketProbeError)
      : Promise.resolve(websocketProbeResult);
  },
  WEBSOCKET_PROBE_TIMEOUT_MS,
}));

const { createReleaseDiagnosticsScreenModel } = await import(
  '../../src/diagnostics/releaseDiagnosticsScreenModel'
);
const { ReleaseDiagnosticsScreen } = await import(
  '../../src/diagnostics/ReleaseDiagnosticsScreen'
);

beforeEach(() => {
  authStatus = 'authenticated';
  startupState = screenModelInput();
  apiProbeResult = { status: 'reachable' };
  websocketProbeResult = {
    status: 'failed',
    reason: 'Websocket connection failed',
  };
  websocketProbeError = null;
  hookStates = [];
  hookIndex = 0;
  apiProbeCalls = [];
  websocketProbeCalls = [];
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

describe('ReleaseDiagnosticsScreen', () => {
  test('renders diagnostics while signed in from startup and auth providers', () => {
    const screen = renderScreen();
    const texts = collectText(screen);

    expect(texts).toContain('Runtime checks');
    expect(texts).toContain('Endpoint configuration');
    expect(texts).toContain('Startup snapshot');
    expect(texts).toContain('Reachability probes');
    expect(texts).toContain('Authenticated');
    expect(texts).toContain('https://preview-api.livecanvas.example');
    expect(texts).toContain('wss://preview-ws.livecanvas.example/socket');
    expect(texts).toContain('Check API');
    expect(texts).toContain('Check websocket');
    expect(texts.join(' ')).not.toContain('secret-access-token');
    expect(texts.join(' ')).not.toContain('secret-refresh-token');
  });

  test('runs API and websocket probes from screen buttons and renders results', async () => {
    let screen = renderScreen();

    await pressButton(screen, 'Check API');
    screen = renderScreen();

    await pressButton(screen, 'Check websocket');
    screen = renderScreen();

    const texts = collectText(screen);

    expect(apiProbeCalls).toEqual(['https://preview-api.livecanvas.example']);
    expect(websocketProbeCalls).toEqual([
      {
        token: 'diagnostic-access-token',
        url: 'wss://preview-ws.livecanvas.example/socket',
      },
    ]);
    expect(texts).toContain('Reachable');
    expect(texts).toContain('Failed: Websocket connection failed');
  });

  test('renders a failed websocket probe when the diagnostic rejects', async () => {
    websocketProbeError = new Error('socket internal failure with secret token');
    let screen = renderScreen();

    await pressButton(screen, 'Check websocket');
    screen = renderScreen();

    const texts = collectText(screen);

    expect(texts).toContain('Failed: Websocket probe failed');
    expect(texts.join(' ')).not.toContain('secret token');
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

function renderScreen(): RenderedTree {
  hookIndex = 0;

  return withHookDispatcher(() =>
    renderNode(createElement(ReleaseDiagnosticsScreen)),
  );
}

function withHookDispatcher<ReturnValue>(render: () => ReturnValue): ReturnValue {
  // Temporary test renderer: Bun has no project-local public RN renderer here.
  // This private dispatcher mock supports only the useState calls this screen uses.
  const previousDispatcher = reactInternals.H;
  reactInternals.H = {
    useState: <State,>(
      initialState: State | (() => State),
    ): [State, (nextState: State | ((current: State) => State)) => void] => {
      const currentIndex = hookIndex;

      if (hookStates.length === currentIndex) {
        hookStates.push(
          typeof initialState === 'function'
            ? (initialState as () => State)()
            : initialState,
        );
      }

      hookIndex += 1;

      return [
        hookStates[currentIndex] as State,
        (nextState) => {
          hookStates[currentIndex] =
            typeof nextState === 'function'
              ? (nextState as (current: State) => State)(
                  hookStates[currentIndex] as State,
                )
              : nextState;
        },
      ];
    },
  };

  try {
    return render();
  } finally {
    reactInternals.H = previousDispatcher;
  }
}

function renderNode(node: unknown): RenderedTree {
  if (
    node === null ||
    node === undefined ||
    typeof node === 'boolean'
  ) {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => renderNode(child));
  }

  if (!isValidElement(node)) {
    return null;
  }

  const element = node as ReactElement<{ children?: unknown }>;

  if (element.type === Fragment) {
    return renderNode(element.props.children);
  }

  if (typeof element.type === 'function') {
    const Component = element.type as (props: unknown) => unknown;
    return renderNode(Component(element.props));
  }

  const { children, ...props } = element.props;

  return {
    children: renderChildren(children),
    props,
    type: String(element.type),
  };
}

function renderChildren(children: unknown): RenderedTree[] {
  const rendered = renderNode(children);

  if (Array.isArray(rendered)) {
    return rendered.flatMap((child) => (child === null ? [] : [child]));
  }

  return rendered === null ? [] : [rendered];
}

function collectText(tree: RenderedTree): string[] {
  if (tree === null) {
    return [];
  }

  if (typeof tree === 'string') {
    return [tree];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap((child) => collectText(child));
  }

  return tree.children.flatMap((child) => collectText(child));
}

async function pressButton(tree: RenderedTree, label: string): Promise<void> {
  const button = findButton(tree, label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  const onPress = button.props.onPress as () => Promise<void> | void;
  await onPress();
}

function findButton(tree: RenderedTree, label: string): HostNode | null {
  return (
    findHostNodes(
      tree,
      (node) =>
        node.type === 'Pressable' &&
        node.props.accessibilityRole === 'button' &&
        collectText(node).includes(label),
    )[0] ?? null
  );
}

function findHostNodes(
  tree: RenderedTree,
  predicate: (node: HostNode) => boolean,
): HostNode[] {
  if (tree === null || typeof tree === 'string') {
    return [];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap((child) => findHostNodes(child, predicate));
  }

  const matches = predicate(tree) ? [tree] : [];
  return matches.concat(
    tree.children.flatMap((child) => findHostNodes(child, predicate)),
  );
}
