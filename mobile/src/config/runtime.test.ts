import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';

mock.module('react-native', () => ({
  Linking: {
    getInitialURL: async () => null,
  },
  Platform: {
    OS: 'ios',
  },
}));

const {
  authRouteHref,
  readAuthReturnToParam,
  resolveLandingHrefForAuth,
  routeHrefFromUrl,
} = await import('./runtime');
mock.restore();

type ModalAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type ModalElement = ReactElement<{
  href?: string;
  message?: string;
  sessionId?: string;
}> | null;

let modalAuthStatus: ModalAuthStatus = 'authenticated';
let modalSearchParams: { sessionId?: string | string[] } = {};

function RedirectMock(_props: { href: string }) {
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
  useLocalSearchParams: () => modalSearchParams,
}));

mock.module('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: modalAuthStatus } }),
}));

mock.module('../../src/components/ScreenState', () => ({
  ScreenState: ScreenStateMock,
}));

mock.module('../../src/live/LiveSessionWatchScreen', () => ({
  LiveSessionWatchScreen: LiveSessionWatchScreenMock,
}));

const { default: LiveSessionModal } = await import(
  '../../app/(modals)/live-session'
);

describe('routeHrefFromUrl', () => {
  test('accepts the sign-up deep link route', () => {
    expect(routeHrefFromUrl('livecanvas-mobile://sign-up')).toBe('/sign-up');
  });

  test('preserves live-session query params in known protected deep links', () => {
    expect(
      routeHrefFromUrl(
        'livecanvas-mobile://live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
      ),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
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

  test('reads only the first live-session return target', () => {
    expect(
      readAuthReturnToParam([
        '/live-session?sessionId=TGl2ZVNlc3Npb246MTIz',
        '/profile',
      ]),
    ).toBe('/live-session?sessionId=TGl2ZVNlc3Npb246MTIz');
  });

  test('rejects external and auth-route return targets', () => {
    expect(readAuthReturnToParam('https://example.com')).toBeNull();
    expect(readAuthReturnToParam('/sign-in')).toBeNull();
    expect(readAuthReturnToParam('/profile')).toBeNull();
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
