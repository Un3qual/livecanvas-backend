import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  Fragment,
  Suspense,
  createElement,
  isValidElement,
  type ReactElement,
} from 'react';

import type { AuthState } from '../../src/auth/types';

type EffectCleanup = () => void;
type EffectCallback = () => EffectCleanup | undefined;

type HookDispatcher = {
  useEffect: (effect: EffectCallback, deps?: unknown[]) => void;
  useReducer: <State, Action>(
    reducer: (state: State, action: Action) => State,
    initialArg: State,
  ) => [State, (action: Action) => void];
  useState: <State>(
    initialState: State | (() => State),
  ) => [State, (nextState: State | ((current: State) => State)) => void];
};

type HostNode = {
  children: RenderedTree[];
  props: Record<string, unknown>;
  type: string;
};

type RenderedTree = HostNode | string | null | readonly RenderedTree[];

const reactInternals = (
  await import('react')
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as {
  H: HookDispatcher | null;
};

let authState: AuthState;
let hookIndex = 0;
let hookStates: unknown[];
let viewerQueryCalls: number;

function AppButtonMock({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return createElement(
    'Pressable',
    { accessibilityRole: 'button', onPress },
    label,
  );
}

mock.module('react-relay', () => ({
  fetchQuery: () => ({
    toPromise: () => Promise.resolve(null),
  }),
  graphql: (query: TemplateStringsArray) => query,
  useLazyLoadQuery: () => {
    viewerQueryCalls += 1;
    return {
      viewer: {
        email: 'viewer@example.com',
        id: 'Viewer:1',
        insertedAt: '2026-06-30T12:00:00.000Z',
        privacyMode: 'PUBLIC',
      },
    };
  },
  useRelayEnvironment: () => ({}),
  useMutation: () => [() => undefined, false],
}));

mock.module('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    getAccessToken: () => authState.status === 'authenticated'
      ? authState.tokens.accessToken
      : null,
    signOut: () => Promise.resolve(),
    state: authState,
  }),
}));

mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: 'accent',
      background: 'background',
      error: 'error',
      errorMuted: 'errorMuted',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));

mock.module('../../src/components/AppButton', () => ({
  AppButton: AppButtonMock,
}));

const { ViewerBootstrap } = await import('../../src/auth/ViewerBootstrap');

beforeEach(() => {
  authState = {
    status: 'authenticated',
    tokens: {
      accessToken: 'access-token',
      expiresAt: '2026-06-30T12:00:00.000Z',
      refreshToken: 'refresh-token',
    },
  };
  hookIndex = 0;
  hookStates = [];
  viewerQueryCalls = 0;
});

describe('ViewerBootstrap', () => {
  test('runs viewer bootstrap for authenticated route children', () => {
    renderViewerBootstrap('home child');

    expect(viewerQueryCalls).toBe(1);
  });

  test('lets unauthenticated route children render without viewer bootstrap', () => {
    authState = { status: 'unauthenticated' };

    const tree = renderViewerBootstrap('sign-in child');

    expect(collectText(tree)).toContain('sign-in child');
    expect(viewerQueryCalls).toBe(0);
  });
});

function renderViewerBootstrap(child: string): RenderedTree {
  hookIndex = 0;

  return withHookDispatcher(() =>
    renderNode(createElement(ViewerBootstrap, null, child)),
  );
}

function withHookDispatcher<ReturnValue>(render: () => ReturnValue): ReturnValue {
  const previousDispatcher = reactInternals.H;
  reactInternals.H = {
    useEffect: () => undefined,
    useReducer: <State, Action>(
      reducer: (state: State, action: Action) => State,
      initialArg: State,
    ): [State, (action: Action) => void] => {
      const currentIndex = hookIndex;

      if (hookStates.length === currentIndex) {
        hookStates.push(initialArg);
      }

      hookIndex += 1;

      return [
        hookStates[currentIndex] as State,
        (action) => {
          hookStates[currentIndex] = reducer(
            hookStates[currentIndex] as State,
            action,
          );
        },
      ];
    },
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

  if (element.type === Fragment || element.type === Suspense) {
    return renderNode(element.props.children);
  }

  if (typeof element.type === 'function') {
    if (
      'prototype' in element.type &&
      element.type.prototype &&
      'isReactComponent' in element.type.prototype
    ) {
      const instance = new element.type(element.props);

      return renderNode(instance.render());
    }

    return renderNode(element.type(element.props));
  }

  if (typeof element.type === 'string') {
    return {
      children: [renderNode(element.props.children)],
      props: element.props as Record<string, unknown>,
      type: element.type,
    };
  }

  return null;
}

function collectText(node: RenderedTree): string[] {
  if (node === null) {
    return [];
  }

  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child) => collectText(child));
  }

  return node.children.flatMap((child) => collectText(child));
}
