import { describe, expect, mock, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';

function NullComponent() {
  return null;
}

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

function AppCardMock({ children }: { children?: ReactNode }) {
  return createElement('View', null, children);
}

function AppHeaderMock({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow?: string;
  subtitle?: string;
  title: string;
}) {
  return createElement('View', null, eyebrow, title, subtitle);
}

function readLiveSessionIdParamMock(
  value?: string | string[],
): string | null {
  const raw = Array.isArray(value)
    ? value.find((candidate) => candidate.trim().length > 0)
    : value;
  const trimmed = raw?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
}

mock.module('expo-router', () => ({
  useRouter: () => ({ push: () => undefined }),
}));
mock.module('react-native', () => ({
  FlatList: NullComponent,
  Linking: {
    canOpenURL: () => Promise.resolve(false),
    openURL: () => Promise.resolve(),
  },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Text: 'Text',
  View: 'View',
}));
mock.module('react-relay', () => ({
  graphql: () => ({}),
  useLazyLoadQuery: () => ({
    liveNow: { edges: [] },
    viewer: { currentLiveSession: null },
  }),
  useMutation: () => [() => undefined, false],
}));
// Bun keeps these module mocks process-wide in the full quality test run, so
// keep shared UI mocks child-rendering for later component presentation tests.
mock.module('../../src/components/AppButton', () => ({
  AppButton: AppButtonMock,
}));
mock.module('../../src/components/AppCard', () => ({ AppCard: AppCardMock }));
mock.module('../../src/components/AppHeader', () => ({
  AppHeader: AppHeaderMock,
}));
mock.module('../../src/components/ScreenState', () => ({
  ScreenState: NullComponent,
}));
mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      background: 'background',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));
// Keep the shared token mock export-complete for later style imports in the
// same Bun test process.
mock.module('../../src/theme/tokens', () => ({
  radius: { lg: 24, md: 14, pill: 999, sm: 8 },
  spacing: { lg: 16, md: 12, sm: 8 },
  touchTarget: { min: 44 },
  typography: { body: {}, label: {} },
}));
mock.module('../../src/live/liveSessionNavigation', () => ({
  liveSessionHref: (sessionId: string) => ({
    params: { sessionId },
    pathname: '/live-session',
  }),
  readLiveSessionIdParam: readLiveSessionIdParamMock,
}));
mock.module('../../src/live/components/LiveSessionSummaryCard', () => ({
  LiveSessionSummaryCard: () => null,
}));

const liveDiscoveryScreen = await import(
  '../../src/live/discovery/LiveDiscoveryScreen'
);

const shouldShowHostCreationAction =
  liveDiscoveryScreen.shouldShowHostCreationAction as
    | ((currentSession: unknown) => boolean)
    | undefined;
const createLiveDiscoveryHomeActions =
  liveDiscoveryScreen.createLiveDiscoveryHomeActions as
    | ((showHostCreationAction: boolean) => Array<{
        key: string;
        label: string;
        route: string;
        variant: string;
      }>)
    | undefined;
const pushLiveDiscoveryHomeAction =
  liveDiscoveryScreen.pushLiveDiscoveryHomeAction as
    | ((
        router: { push: (route: string) => void },
        action: { route: string },
      ) => void)
    | undefined;

describe('LiveDiscoveryScreen presentation', () => {
  test('only shows host creation when the viewer does not already have a current session', () => {
    expect(shouldShowHostCreationAction?.(null)).toBe(true);
    expect(shouldShowHostCreationAction?.()).toBe(true);
    expect(shouldShowHostCreationAction?.({ id: 'session-1' })).toBe(false);
  });

  test('keeps Diagnostics as a secondary home action near profile', () => {
    expect(createLiveDiscoveryHomeActions?.(true)).toEqual([
      {
        key: 'host',
        label: 'Host a live session',
        route: '/host-broadcast',
        variant: 'primary',
      },
      {
        key: 'profile',
        label: 'Open profile',
        route: '/profile',
        variant: 'secondary',
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics',
        route: '/diagnostics',
        variant: 'secondary',
      },
    ]);

    expect(createLiveDiscoveryHomeActions?.(false)).toEqual([
      {
        key: 'profile',
        label: 'Open profile',
        route: '/profile',
        variant: 'secondary',
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics',
        route: '/diagnostics',
        variant: 'secondary',
      },
    ]);
  });

  test('pushes the Diagnostics route when the home action is pressed', () => {
    const pushedRoutes: string[] = [];
    const diagnosticsAction = createLiveDiscoveryHomeActions?.(true).find(
      (action) => action.key === 'diagnostics',
    );

    expect(diagnosticsAction).toBeDefined();

    if (!diagnosticsAction) {
      throw new Error('Diagnostics action should exist');
    }

    pushLiveDiscoveryHomeAction?.(
      {
        push: (route) => {
          pushedRoutes.push(route);
        },
      },
      diagnosticsAction,
    );

    expect(pushedRoutes).toEqual(['/diagnostics']);
  });
});
