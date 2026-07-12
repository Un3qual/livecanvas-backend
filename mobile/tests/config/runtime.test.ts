import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';

function NullReactNativeComponent() {
  return null;
}

mock.module('react-native', () => ({
  ActivityIndicator: NullReactNativeComponent,
  FlatList: NullReactNativeComponent,
  Linking: { getInitialURL: () => Promise.resolve(null) },
  Platform: { OS: 'ios' },
  Pressable: NullReactNativeComponent,
  RefreshControl: NullReactNativeComponent,
  ScrollView: NullReactNativeComponent,
  StyleSheet: {
    create: <Styles>(styles: Styles): Styles => styles,
  },
  Text: NullReactNativeComponent,
  TextInput: NullReactNativeComponent,
  View: NullReactNativeComponent,
}));

const {
  authRouteHref,
  bootstrapRuntime,
  readAuthReturnToParam,
  resolveLandingHrefForAuth,
  routeHrefFromUrl,
} = await import('../../src/config/runtime');

type ModalAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type ModalElement = ReactElement<{
  href?: string;
  message?: string;
  sessionId?: string;
}> | null;

let appPathname = '/home';
let modalAuthStatus: ModalAuthStatus = 'authenticated';
let modalSearchParams: { sessionId?: string | string[] } = {};

function RedirectMock(_props: { href: string }) {
  return null;
}

function StackMock(_props: { initialRouteName?: string }) {
  return null;
}

function ScreenStateMock(_props: { state: string; message: string }) {
  return null;
}

function LiveSessionWatchScreenMock(_props: { sessionId: string }) {
  return null;
}

mock.module('expo-router', () => ({
  Redirect: RedirectMock,
  Stack: StackMock,
  useLocalSearchParams: () => modalSearchParams,
  usePathname: () => appPathname,
  useRouter: () => ({ push: () => undefined }),
}));

mock.module('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: modalAuthStatus } }),
}));

mock.module('../../src/components/ScreenState', () => ({
  ScreenState: ScreenStateMock,
}));

mock.module('../../src/live/watch/LiveSessionWatchScreen', () => ({
  LiveSessionWatchScreen: LiveSessionWatchScreenMock,
}));

const { default: AppLayout } = await import('../../app/(app)/_layout');
const { default: LiveSessionModal } = await import(
  '../../app/(modals)/live-session'
);

describe('routeHrefFromUrl', () => {
  test('accepts only opaque handoff invite routes', () => {
    expect(
      routeHrefFromUrl(
        'livecanvas-mobile://invite?handoff=550e8400-e29b-41d4-a716-446655440000',
      ),
    ).toBe('/invite?handoff=550e8400-e29b-41d4-a716-446655440000');
    expect(
      routeHrefFromUrl('livecanvas-mobile://invite?token=secret'),
    ).toBeNull();
    expect(routeHrefFromUrl('livecanvas-mobile://invite')).toBe('/invite');
  });
  test('accepts the sign-up deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://sign-up')).toBe('/sign-up');
  });

  test('accepts password recovery auth routes and reset tokens', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://password-recovery')).toBe(
      '/password-recovery',
    );
    expect(
      routeHrefFromUrl('livecanvas-mobile://reset-password?token=reset-token'),
    ).toBe('/reset-password?token=reset-token');
  });

  test('maps backend password reset links to the mobile reset route', () => {
    expect(
      routeHrefFromUrl('livecanvas-mobile://users/reset-password/reset-token'),
    ).toBe('/reset-password?token=reset-token');
    expect(
      routeHrefFromUrl(
        'https://livecanvas.invalid/users/reset-password/reset-token',
      ),
    ).toBe('/reset-password?token=reset-token');
  });

  test('does not double-encode backend password reset tokens', () => {
    expect(
      routeHrefFromUrl(
        'https://livecanvas.invalid/users/reset-password/abc%2Bdef',
      ),
    ).toBe('/reset-password?token=abc%2Bdef');
  });

  test('preserves live-session query params in known protected deep links', () => {
    expect(
      routeHrefFromUrl(
        'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
      ),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
  });

  test('accepts the host-broadcast modal deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://host-broadcast')).toBe(
      '/host-broadcast',
    );
  });

  test('accepts the compose deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://compose')).toBe('/compose');
  });

  test('accepts the diagnostics deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://diagnostics')).toBe(
      '/diagnostics',
    );
  });

  test('strips query params from known non-live routes', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://sign-in?x=1')).toBe(
      '/sign-in',
    );
  });

  test('rejects unknown routes with query params', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://unknown?x=1')).toBeNull();
  });

  test('strips fragments while preserving live-session query params', () => {
    expect(
      routeHrefFromUrl(
        'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz#fragment',
      ),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
  });
});

describe('resolveLandingHrefForAuth', () => {
  test('keeps the neutral invite route public while signed out', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: '/invite?handoff=550e8400-e29b-41d4-a716-446655440000',
          initialHref: '/invite?handoff=550e8400-e29b-41d4-a716-446655440000',
          landingHref: '/invite?handoff=550e8400-e29b-41d4-a716-446655440000',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/invite?handoff=550e8400-e29b-41d4-a716-446655440000');
  });
  test('sends unauthenticated cold starts to sign-in when the deep link is protected', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://profile',
          initialHref: '/profile',
          landingHref: '/profile',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/sign-in');
  });

  test('preserves auth route deep links for unauthenticated sessions', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://sign-up',
          initialHref: '/sign-up',
          landingHref: '/sign-up',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/sign-up');
  });

  test('preserves reset-password deep links for unauthenticated sessions', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl:
            'livecanvas-mobile://users/reset-password/reset-token',
          initialHref: '/reset-password?token=reset-token',
          landingHref: '/reset-password?token=reset-token',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/reset-password?token=reset-token');
  });

  test('sends authenticated auth-route cold starts to home', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://sign-in',
          initialHref: '/sign-in',
          landingHref: '/sign-in',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'authenticated',
      ),
    ).toBe('/home');
  });

  test('sends forced logout snapshots to sign-in after authenticated auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://profile',
          initialHref: '/profile',
          landingHref: '/sign-in',
          defaultHref: '/home',
          bootSessionState: 'forced_logout',
          resetReason: 'forced_logout',
        },
        'authenticated',
      ),
    ).toBe('/sign-in');
  });

  test('keeps forced logout snapshots loading until auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://profile',
          initialHref: '/profile',
          landingHref: '/sign-in',
          defaultHref: '/home',
          bootSessionState: 'forced_logout',
          resetReason: 'forced_logout',
        },
        'loading',
      ),
    ).toBeNull();
  });

  test('sends unauthenticated live-session deep links to sign-in with a return target', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl:
            'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          initialHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          landingHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe(
      '/sign-in?returnTo=%2Flive-session%3FsessionId%3DTGl2ZVNlc3Npb246MTIz',
    );
  });

  test('preserves authenticated live-session deep links after auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl:
            'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          initialHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          landingHref: '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
          defaultHref: '/home',
          bootSessionState: 'authenticated',
          resetReason: null,
        },
        'authenticated',
      ),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
  });

  test('sends unauthenticated host-broadcast deep links to sign-in with a return target', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://host-broadcast',
          initialHref: '/host-broadcast',
          landingHref: '/host-broadcast',
          defaultHref: '/sign-in',
          bootSessionState: 'signed_out',
          resetReason: null,
        },
        'unauthenticated',
      ),
    ).toBe('/sign-in?returnTo=%2Fhost-broadcast');
  });

  test('preserves authenticated host-broadcast deep links after auth settles', () => {
    expect(
      resolveLandingHrefForAuth(
        {
          initialUrl: 'livecanvas-mobile://host-broadcast',
          initialHref: '/host-broadcast',
          landingHref: '/host-broadcast',
          defaultHref: '/home',
          bootSessionState: 'authenticated',
          resetReason: null,
        },
        'authenticated',
      ),
    ).toBe('/host-broadcast');
  });

  test('preserves diagnostics deep links across auth routing', () => {
    const snapshot = {
      initialUrl: 'livecanvas-mobile://diagnostics',
      initialHref: '/diagnostics',
      landingHref: '/diagnostics',
      defaultHref: '/home',
      bootSessionState: 'authenticated' as const,
      resetReason: null,
    };

    expect(resolveLandingHrefForAuth(snapshot, 'authenticated')).toBe(
      '/diagnostics',
    );
    expect(
      resolveLandingHrefForAuth(
        { ...snapshot, bootSessionState: 'signed_out', defaultHref: '/sign-in' },
        'unauthenticated',
      ),
    ).toBe('/sign-in?returnTo=%2Fdiagnostics');
  });

  test('preserves compose deep links across auth routing', () => {
    const snapshot = {
      initialUrl: 'livecanvas-mobile://compose',
      initialHref: '/compose',
      landingHref: '/compose',
      defaultHref: '/home',
      bootSessionState: 'authenticated' as const,
      resetReason: null,
    };

    expect(resolveLandingHrefForAuth(snapshot, 'authenticated')).toBe(
      '/compose',
    );
    expect(
      resolveLandingHrefForAuth(
        { ...snapshot, bootSessionState: 'signed_out', defaultHref: '/sign-in' },
        'unauthenticated',
      ),
    ).toBe('/sign-in?returnTo=%2Fcompose');
  });

  test('preserves settings and contacts deep links across auth routing', () => {
    const settingsSnapshot = {
      initialUrl: 'livecanvas-mobile://settings',
      initialHref: '/settings',
      landingHref: '/settings',
      defaultHref: '/home',
      bootSessionState: 'authenticated' as const,
      resetReason: null,
    };
    const contactsSnapshot = {
      initialUrl: 'livecanvas-mobile://contacts',
      initialHref: '/contacts',
      landingHref: '/contacts',
      defaultHref: '/home',
      bootSessionState: 'authenticated' as const,
      resetReason: null,
    };

    expect(resolveLandingHrefForAuth(settingsSnapshot, 'authenticated')).toBe(
      '/settings',
    );
    expect(resolveLandingHrefForAuth(contactsSnapshot, 'authenticated')).toBe(
      '/contacts',
    );
    expect(
      resolveLandingHrefForAuth(
        {
          ...settingsSnapshot,
          bootSessionState: 'signed_out',
          defaultHref: '/sign-in',
        },
        'unauthenticated',
      ),
    ).toBe('/sign-in?returnTo=%2Fsettings');
    expect(
      resolveLandingHrefForAuth(
        {
          ...contactsSnapshot,
          bootSessionState: 'signed_out',
          defaultHref: '/sign-in',
        },
        'unauthenticated',
      ),
    ).toBe('/sign-in?returnTo=%2Fcontacts');
  });
});

describe('auth return targets', () => {
  test('round trips only one opaque invite handoff', () => {
    const inviteHref = '/invite?handoff=550e8400-e29b-41d4-a716-446655440000';

    expect(authRouteHref('/sign-in', inviteHref)).toBe(
      '/sign-in?returnTo=%2Finvite%3Fhandoff%3D550e8400-e29b-41d4-a716-446655440000',
    );
    expect(readAuthReturnToParam(inviteHref)).toBe(inviteHref);
  });

  test('rejects token-bearing, malformed, array, duplicate, and nested return targets', () => {
    expect(readAuthReturnToParam('/invite?token=secret')).toBeNull();
    expect(readAuthReturnToParam('/invite?handoff=%E0%A4%A')).toBeNull();
    expect(
      readAuthReturnToParam([
        '/invite?handoff=550e8400-e29b-41d4-a716-446655440000',
      ]),
    ).toBeNull();
    expect(
      readAuthReturnToParam(
        '/invite?handoff=550e8400-e29b-41d4-a716-446655440000&handoff=other-handoff',
      ),
    ).toBeNull();
    expect(
      readAuthReturnToParam(
        '/invite?handoff=550e8400-e29b-41d4-a716-446655440000&returnTo=%2Fsettings',
      ),
    ).toBeNull();
  });

  test('encodes live-session return targets on auth routes', () => {
    expect(
      authRouteHref(
        '/sign-in',
        '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
      ),
    ).toBe(
      '/sign-in?returnTo=%2Flive-session%3FsessionId%3DTGl2ZVNlc3Npb246MTIz',
    );
  });

  test('encodes host-broadcast return targets on auth routes', () => {
    expect(authRouteHref('/sign-in', '/host-broadcast')).toBe(
      '/sign-in?returnTo=%2Fhost-broadcast',
    );
  });

  test('encodes diagnostics return targets on auth routes', () => {
    expect(authRouteHref('/sign-in', '/diagnostics')).toBe(
      '/sign-in?returnTo=%2Fdiagnostics',
    );
  });

  test('encodes compose return targets on auth routes', () => {
    expect(authRouteHref('/sign-in', '/compose')).toBe(
      '/sign-in?returnTo=%2Fcompose',
    );
  });

  test('encodes settings and contacts return targets on auth routes', () => {
    expect(authRouteHref('/sign-in', '/settings')).toBe(
      '/sign-in?returnTo=%2Fsettings',
    );
    expect(authRouteHref('/sign-in', '/contacts')).toBe(
      '/sign-in?returnTo=%2Fcontacts',
    );
  });

  test('rejects array return targets', () => {
    expect(
      readAuthReturnToParam([
        '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        '/profile',
      ]),
    ).toBeNull();
  });

  test('reads host-broadcast return targets', () => {
    expect(readAuthReturnToParam('/host-broadcast')).toBe('/host-broadcast');
  });

  test('reads diagnostics return targets', () => {
    expect(readAuthReturnToParam('/diagnostics')).toBe('/diagnostics');
  });

  test('reads compose return targets', () => {
    expect(readAuthReturnToParam('/compose')).toBe('/compose');
  });

  test('reads settings and contacts return targets', () => {
    expect(readAuthReturnToParam('/settings')).toBe('/settings');
    expect(readAuthReturnToParam('/contacts')).toBe('/contacts');
  });

  test('rejects external and auth-route return targets', () => {
    expect(readAuthReturnToParam('https://example.com')).toBeNull();
    expect(readAuthReturnToParam('/sign-in')).toBeNull();
    expect(readAuthReturnToParam('/profile')).toBeNull();
  });
});

describe('contact invite startup bootstrap', () => {
  const environment = {
    apiBaseUrl: 'https://api.example.test',
    websocketUrl: 'wss://api.example.test/socket',
    bootSessionState: 'signed_out' as const,
  };

  test('redacts a deep-link token without competing with native-intent storage', async () => {
    const snapshot = await bootstrapRuntime(environment, {
      getInitialUrl: () =>
        Promise.resolve('livecanvas-mobile://invite?token=serialized-secret'),
    });

    expect(snapshot).toEqual({
      initialUrl: '/invite',
      initialHref: '/invite',
      landingHref: '/invite',
      defaultHref: '/sign-in',
      bootSessionState: 'signed_out',
      resetReason: null,
    });
    expect(JSON.stringify(snapshot)).not.toContain('serialized-secret');
  });

  test('redacts one HTTPS fragment token from the startup snapshot', async () => {
    const snapshot = await bootstrapRuntime(environment, {
      getInitialUrl: () =>
        Promise.resolve('https://app.example.test/invites#token=https-secret'),
    });

    expect(snapshot.initialHref).toBe('/invite');
    expect(JSON.stringify(snapshot)).not.toContain('https-secret');
  });

  test('uses the generic invite state for malformed, duplicate, or failed storage', async () => {
    for (const initialUrl of [
      'livecanvas-mobile://invite?token=',
      'livecanvas-mobile://invite?token=one&token=two',
      'https://app.example.test/invites#token=%E0%A4%A',
    ]) {
      const snapshot = await bootstrapRuntime(environment, {
        getInitialUrl: () => Promise.resolve(initialUrl),
      });

      expect(snapshot.initialUrl).toBe('/invite');
      expect(snapshot.initialHref).toBe('/invite');
    }
  });

  test('redacts structurally recognizable malformed custom-scheme invite attempts', async () => {
    const longSlashRunCandidates = [4, 12, 64].map(
      (slashCount) =>
        `livecanvas-mobile:${'/'.repeat(slashCount)}invite?token=raw-secret`,
    );

    for (const initialUrl of [
      'livecanvas-mobile:/invite?token=raw-secret',
      'livecanvas-mobile:///invite?token=raw-secret',
      'livecanvas-mobile:invite?token=raw-secret',
      'livecanvas-mobile://user@invite:not-a-port?token=raw-secret',
      ...longSlashRunCandidates,
    ]) {
      const snapshot = await bootstrapRuntime(environment, {
        getInitialUrl: () => Promise.resolve(initialUrl),
      });

      expect(snapshot.initialUrl).toBe('/invite');
      expect(snapshot.initialHref).toBe('/invite');
      expect(JSON.stringify(snapshot)).not.toContain('raw-secret');
    }
  });

  test('preserves unrelated custom-scheme routes in the startup snapshot', async () => {
    for (const initialUrl of [
      'livecanvas-mobile://profile',
      'livecanvas-mobile:/contacts?filter=invite',
      'livecanvas-mobile:settings?token=not-an-invite-token',
    ]) {
      const snapshot = await bootstrapRuntime(environment, {
        getInitialUrl: () => Promise.resolve(initialUrl),
      });

      expect(snapshot.initialUrl).toBe(initialUrl);
    }
  });
});

describe('AppLayout auth guard', () => {
  test('preserves direct compose routes through unauthenticated app redirects', () => {
    modalAuthStatus = 'unauthenticated';
    appPathname = '/compose';

    const element = AppLayout() as ModalElement;

    expect(element?.type).toBe(RedirectMock);
    expect(element?.props.href).toBe('/sign-in?returnTo=%2Fcompose');
  });
});

describe('LiveSessionModal', () => {
  test('returns nothing while auth is loading', () => {
    modalAuthStatus = 'loading';
    modalSearchParams = { sessionId: 'TGl2ZVNlc3Npb246MTIz' };

    expect(LiveSessionModal()).toBeNull();
  });

  test('redirects unauthenticated direct live-session deep links to sign-in', () => {
    modalAuthStatus = 'unauthenticated';
    modalSearchParams = { sessionId: 'TGl2ZVNlc3Npb246MTIz' };

    const element = LiveSessionModal() as ModalElement;

    expect(element?.type).toBe(RedirectMock);
    expect(element?.props.href).toBe(
      '/sign-in?returnTo=%2Flive-session%3FsessionId%3DTGl2ZVNlc3Npb246MTIz',
    );
  });

  test('keeps missing-session state for authenticated users', () => {
    modalAuthStatus = 'authenticated';
    modalSearchParams = {};

    const element = LiveSessionModal() as ModalElement;

    expect(element?.type).toBe(ScreenStateMock);
    expect(element?.props.message).toBe('Choose a live session to continue.');
  });
});
