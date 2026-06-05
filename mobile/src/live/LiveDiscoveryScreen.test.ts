import { describe, expect, mock, test } from 'bun:test';

mock.module('expo-router', () => ({
  useRouter: () => ({ push: () => undefined }),
}));
mock.module('react-native', () => ({
  ScrollView: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
  Text: () => null,
  View: () => null,
}));
mock.module('react-relay', () => ({
  graphql: () => ({}),
  useLazyLoadQuery: () => ({
    liveNow: { edges: [] },
    viewer: { currentLiveSession: null },
  }),
}));
mock.module('../components/AppButton', () => ({ AppButton: () => null }));
mock.module('../components/AppCard', () => ({ AppCard: () => null }));
mock.module('../components/AppHeader', () => ({ AppHeader: () => null }));
mock.module('../components/ScreenState', () => ({ ScreenState: () => null }));
mock.module('../providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      background: 'background',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));
mock.module('../theme/tokens', () => ({
  spacing: { lg: 16, md: 12, sm: 8 },
  typography: { body: {}, label: {} },
}));
mock.module('./liveSessionNavigation', () => ({
  liveSessionHref: (sessionId: string) => ({
    params: { sessionId },
    pathname: '/live-session',
  }),
}));
mock.module('./LiveSessionSummaryCard', () => ({
  LiveSessionSummaryCard: () => null,
}));

const liveDiscoveryScreen = await import('./LiveDiscoveryScreen');

const shouldShowHostCreationAction =
  liveDiscoveryScreen.shouldShowHostCreationAction as
    | ((currentSession: unknown) => boolean)
    | undefined;

describe('LiveDiscoveryScreen presentation', () => {
  test('only shows host creation when the viewer does not already have a current session', () => {
    expect(shouldShowHostCreationAction?.(null)).toBe(true);
    expect(shouldShowHostCreationAction?.(undefined)).toBe(true);
    expect(shouldShowHostCreationAction?.({ id: 'session-1' })).toBe(false);
  });
});
