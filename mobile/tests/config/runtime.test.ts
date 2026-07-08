import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';

const {
  authRouteHref,
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
});

describe('auth return targets', () => {
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

  test('reads only the first live-session return target', () => {
    expect(
      readAuthReturnToParam([
        '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        '/profile',
      ]),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
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

  test('rejects external and auth-route return targets', () => {
    expect(readAuthReturnToParam('https://example.com')).toBeNull();
    expect(readAuthReturnToParam('/sign-in')).toBeNull();
    expect(readAuthReturnToParam('/profile')).toBeNull();
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
