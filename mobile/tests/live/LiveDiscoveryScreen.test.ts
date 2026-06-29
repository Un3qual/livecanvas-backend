import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import type { ReactNode } from 'react';

mock.module('expo-router', () => ({
  useRouter: () => ({ push: () => undefined }),
}));
mock.module('react-relay', () => ({
  graphql: () => ({}),
  useLazyLoadQuery: () => ({
    liveNow: { edges: [] },
    viewer: { currentLiveSession: null },
  }),
}));
// Bun keeps these module mocks process-wide in the full quality test run, so
// keep shared UI mocks child-rendering for later component presentation tests.
mock.module('../../src/components/AppButton', () => ({
  AppButton: ({
    disabled,
    label,
    onPress,
  }: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
  }) =>
    React.createElement(
      'Pressable',
      { disabled: disabled ?? false, onPress },
      React.createElement('Text', null, label),
    ),
}));
mock.module('../../src/components/AppCard', () => ({
  AppCard: ({ children }: { children?: ReactNode }) =>
    React.createElement('AppCard', null, children),
}));
mock.module('../../src/components/AppHeader', () => ({ AppHeader: () => null }));
mock.module('../../src/components/ScreenState', () => ({ ScreenState: () => null }));
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

describe('LiveDiscoveryScreen presentation', () => {
  test('only shows host creation when the viewer does not already have a current session', () => {
    expect(shouldShowHostCreationAction?.(null)).toBe(true);
    expect(shouldShowHostCreationAction?.()).toBe(true);
    expect(shouldShowHostCreationAction?.({ id: 'session-1' })).toBe(false);
  });
});
