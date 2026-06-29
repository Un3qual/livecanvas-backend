import { describe, expect, mock, test } from 'bun:test';

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
mock.module('../../src/components/AppButton', () => ({ AppButton: () => null }));
mock.module('../../src/components/AppCard', () => ({ AppCard: () => null }));
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
mock.module('../../src/theme/tokens', () => ({
  spacing: { lg: 16, md: 12, sm: 8 },
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
